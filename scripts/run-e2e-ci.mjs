import 'dotenv/config';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';


const CHAT_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 5);
const CHAT_RETRY_BASE_MS = Number(process.env.OPENROUTER_RETRY_BASE_MS || 2000);


const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey || apiKey.startsWith('$(')) {
  console.error('OPENROUTER_API_KEY is missing. Add it to the Azure variable group acmilan-e2e-secrets.');
  process.exit(1);
}

const model = process.env.OPENROUTER_AI_MODEL?.trim();

if (!model) {
  console.error('OPENROUTER_AI_MODEL is missing.');
  process.exit(1);
}

const maxTurns = Number(process.env.OPENROUTER_MAX_TURNS || 300);

// MCP SDK default request timeout is 60s: too short for slow CI machines / heavy pages.
const mcpToolTimeout = Number(process.env.MCP_TOOL_TIMEOUT || 180000);

// Parametri pipeline (booleani "true"/"false"): la costruzione delle liste avviene qui in JS.
const isEnabled = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).trim().toLowerCase() === 'true';
};

const browsers = [
  isEnabled('RUN_CHROMIUM', true) ? 'chromium' : null,
  isEnabled('RUN_FIREFOX', false) ? 'firefox' : null,
  isEnabled('RUN_WEBKIT', false) ? 'webkit' : null,
].filter(Boolean);

if (!browsers.length) {
  console.error('No browser selected (RUN_CHROMIUM / RUN_FIREFOX / RUN_WEBKIT).');
  process.exit(1);
}

// Viewport da testare. Ogni run gira su browser x viewport.
const viewports = [
  isEnabled('RUN_DESKTOP', true) ? '1280x650' : null,
  isEnabled('RUN_TABLET', false) ? '768x1024' : null,
  isEnabled('RUN_MOBILE', false) ? '390x844' : null,
].filter(Boolean);

if (!viewports.length) {
  console.error('No viewport selected (RUN_DESKTOP / RUN_TABLET / RUN_MOBILE).');
  process.exit(1);
}

console.log(`Browsers: ${browsers.join(', ')}`);
console.log(`Viewports: ${viewports.join(', ')}`);
console.log(`Total runs: ${browsers.length * viewports.length} (browser x viewport)`);

await main();

async function main() {
  let failed = false;

  for (const browser of browsers) {
    for (const viewport of viewports) {
      console.log(`\n========== E2E on ${browser} @ ${viewport} - AI Model: ${model} ==========\n`);
      const code = await runForBrowser(browser, viewport);
      if (code !== 0) {
        failed = true;
        process.exitCode = Math.max(process.exitCode || 0, code);
      }
    }
  }

  if (failed) {
    console.error('One or more browsers failed.');
  }
}

async function runForBrowser(browser, viewport) {
  // MCP servers: playwright (browser) + filesystem + shell (desktop-commander)
  const servers = [
    {
      name: 'playwright',
      transport: new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@playwright/mcp@latest', '--headless', '--isolated', '--browser', browser],
        cwd: process.cwd(),
        env: {
          ...process.env,
          PLAYWRIGHT_MCP_BROWSER: browser,
          PLAYWRIGHT_MCP_ISOLATED: 'true',
        },
      }),
    },
    {
      name: 'filesystem',
      transport: new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
        cwd: process.cwd(),
      }),
    },
    {
      name: 'shell',
      transport: new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@wonderwhy-er/desktop-commander'],
        cwd: process.cwd(),
      }),
    },
  ];

  const clients = [];
  const tools = [];
  const toolMap = new Map(); // tool name -> { client, mcpName }

  try {
    for (const server of servers) {
      const client = new Client({ name: 'e2e-ci-agent', version: '1.0.0' });
      console.log(`[mcp] connecting to ${server.name}...`);
      await client.connect(server.transport);
      console.log(`[mcp] ${server.name} connected`);
      const { tools: mcpTools } = await client.listTools();
      for (const t of mcpTools) {
        const exposedName = `${server.name}__${t.name}`;
        tools.push({
          type: 'function',
          function: {
            name: exposedName,
            description: `[${server.name}] ${t.description ?? ''}`,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        });
        toolMap.set(exposedName, { client, mcpName: t.name });
      }
      clients.push(client);
      console.log(`[mcp] ${server.name}: ${mcpTools.length} tools`);
    }
    console.log(`[mcp] ${tools.length} total tools available (browser=${browser})`);

    const messages = [
      { role: 'user', content: buildPrompt(browser, viewport) },
    ];

    let finalText = '';
    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await chatCompletion(messages, tools);
      const choice = response.choices?.[0]?.message;
      if (!choice) {
        console.error(`${browser}: empty response from OpenRouter.`);
        return 2;
      }

      messages.push(choice);

      const toolCalls = choice.tool_calls ?? [];
      if (choice.content) {
        process.stdout.write(choice.content);
        finalText += `\n${choice.content}`;
      }

      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        const name = call.function.name;
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        console.log(`[tool] ${name} args=${JSON.stringify(args).slice(0, 500)}`);
        const startedAt = Date.now();
        let result;
        try {
          const entry = toolMap.get(name);
          if (!entry) throw new Error(`Unknown tool: ${name}`);
          const res = await entry.client.callTool(
            { name: entry.mcpName, arguments: args },
            undefined,
            { timeout: mcpToolTimeout },
          );
          const parts = Array.isArray(res.content) ? res.content : [];
          result =
            parts
              .map((p) => (p.type === 'text' ? p.text : p.type === 'image' ? '[image content omitted]' : `[${p.type}]`))
              .join('\n') || JSON.stringify(res);
        } catch (err) {
          const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.error(`[tool] ${name} FAILED after ${duration}s: ${err.message}`);
          result = `TOOL ERROR: ${err.message}`;
        }
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`[tool] ${name} done in ${duration}s (result ${String(result).length} chars)`);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: String(result).slice(0, 200000),
        });
      }
    }

    console.log(`\n--- ${browser} @ ${viewport} finished ---`);

    archiveSummary(browser, model, viewport);

    if (!finalText.includes('CI_STATUS=PASS')) {
      console.error(`${browser}: CI_STATUS is not PASS.`);
      return 2;
    }

    return 0;
  } catch (err) {
    console.error(`${browser} run failed: ${err.message}`, err);
    return 1;
  } finally {
    for (const client of clients) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
  }
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatCompletion(messages, tools) {
  const body = JSON.stringify({
    model,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0,
  });

  let lastErr;
  for (let attempt = 1; attempt <= CHAT_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (res.ok) return res.json();

      const errBody = await res.text();
      // Retry on rate limits and transient server errors.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter API error ${res.status}: ${errBody.slice(0, 500)}`);
        console.warn(`[llm] attempt ${attempt}/${CHAT_MAX_RETRIES} failed (HTTP ${res.status}), retrying...`);
      } else {
        throw new Error(`OpenRouter API error ${res.status}: ${errBody.slice(0, 500)}`);
      }
    } catch (err) {
      // Network-level failures (socket closed, timeout, DNS) are transient: retry.
      if (err.message?.startsWith('OpenRouter API error')) throw err;
      lastErr = err;
      console.warn(`[llm] attempt ${attempt}/${CHAT_MAX_RETRIES} failed (${err.message}), retrying...`);
    }

    if (attempt < CHAT_MAX_RETRIES) {
      await sleep(CHAT_RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }

  throw lastErr;
}

function buildPrompt(browser, viewport) {
  return `Sei in CI Azure, senza operatore umano. Esegui i test E2E di questo repository.

Browser obbligatorio per questa run: ${browser}
Viewport obbligatorio per questa run: ${viewport} (usa browser_resize con width/height corrispondenti PRIMA di navigare, e rispettalo per tutto il test)

Hai accesso a questi gruppi di tool MCP (prefisso nel nome del tool):
- filesystem__: leggi/scrivi file del repository (working directory: ${process.cwd()})
- shell__: esegui comandi nel terminale (es. shell__start_terminal_process, shell__interact_with_process)
- playwright__: automazione browser ${browser} (snapshot, click, type, screenshot, ecc.)

Regole:
1. Leggi AGENTS.md con un tool filesystem e rispettane tutte le regole (report, screenshot solo sui bug, italiano, cleanup).
2. Usa SOLO launcher-ci.yaml (ignora launcher.yaml). Leggilo con un tool filesystem.
3. Esegui i test con action: run. Salta quelli con skip. Se un test ha action: only, esegui solo quello.
4. Usa i tool playwright__ per il browser ${browser}: profilo isolato, headless, viewport ${viewport} (sovrascrive config.viewport del launcher).
5. Chiudi cookie banner / popup / overlay upsell come da istruzioni.
6. Scrivi i report in reports/ con la struttura richiesta dalle istruzioni (usa i tool filesystem per creare i file). Nel report indica chiaramente: browser (${browser}), viewport (${viewport}) e modello AI (${model}). Includi gli screenshot come immagini markdown ![descrizione](reports/<cartella>/screenshot-XXX.png), MAI come semplici path testuali. Indica l'esito di ogni test come PASS o FAIL.
7. Alla fine crea DUE file:
   a) reports/ci-summary.md con: browser (${browser}), viewport (${viewport}), modello AI (${model}), data, test eseguiti (uno per riga con esito PASS o FAIL), esito complessivo, path dei report, path degli screenshot, conteggio bug HIGH/MEDIUM/LOW.
   b) reports/ci-data.json con ESATTAMENTE questo schema JSON (valido, nessun testo extra):
      {
        "browser": "${browser}",
        "viewport": "${viewport}",
        "model": "${model}",
        "date": "YYYY-MM-DD",
        "duration": "es. 12m 30s",
        "status": "PASS" | "FAIL",
        "tests": [{ "name": "pdp.test.md", "status": "PASS" | "FAIL", "report": "reports/<cartella>/<file>.md" }],
        "bugs": { "high": 0, "medium": 0, "low": 0 },
        "reportPaths": ["reports/..."],
        "screenshotPaths": ["reports/..."]
      }
      "tests" contiene SOLO i test eseguiti (action run/only), non quelli saltati. "report" e' il path del report .md del test (se esiste, altrimenti stringa vuota).
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, oppure se un test non e' completabile.`;
}

function archiveSummary(browser, model, viewport) {
  const source = 'reports/ci-summary.md';
  const target = `reports/ci-summary-${browser}-${viewport}.md`;
  if (existsSync(source)) {
    renameSync(source, target);
    console.log(`Saved ${target}`);
  }

  // Dati strutturati per rendering HTML e email (niente parsing regex del markdown).
  const jsonSource = 'reports/ci-data.json';
  const jsonTarget = `reports/ci-data-${browser}-${viewport}.json`;
  if (existsSync(jsonSource)) {
    renameSync(jsonSource, jsonTarget);
    try {
      const data = JSON.parse(readFileSync(jsonTarget, 'utf8'));
      // Override deterministico dei campi chiave.
      data.browser = browser;
      data.viewport = viewport;
      data.model = model;
      data.timestamp = new Date().toISOString();
      if (data.status !== 'PASS' && data.status !== 'FAIL') data.status = '';
      writeFileSync(jsonTarget, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Saved ${jsonTarget}`);
    } catch (err) {
      console.error(`Invalid ${jsonTarget}: ${err.message} — rendering/email useranno il fallback markdown.`);
    }
  } else {
    console.error(`Missing ${jsonSource} — rendering/email useranno il fallback markdown.`);
  }
}
