import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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

const browsers = (process.env.BROWSERS || 'chromium,firefox,webkit')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

if (!browsers.length) {
  console.error('BROWSERS is empty.');
  process.exit(1);
}

await main();

async function main() {
  console.log(`========== E2E parallel run - AI Model: ${model} - Browsers: ${browsers.join(', ')} ==========\n`);

  // Browsers run in parallel: each one gets its own MCP servers (own browser instance)
  // and writes to browser-specific report files (ci-summary-<browser>.md, ci-data-<browser>.json).
  const results = await Promise.all(browsers.map((browser) => runForBrowser(browser)));

  const failed = results.some((code) => code !== 0);
  if (failed) {
    process.exitCode = Math.max(...results.filter((code) => code !== 0));
    console.error('One or more browsers failed.');
  }
}

async function runForBrowser(browser) {
  // Parallel runs interleave console output: prefix every line with the browser name.
  const log = (...args) => console.log(`[${browser}]`, ...args);
  const logError = (...args) => console.error(`[${browser}]`, ...args);

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
      log(`[mcp] connecting to ${server.name}...`);
      await client.connect(server.transport);
      log(`[mcp] ${server.name} connected`);
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
    log(`[mcp] ${tools.length} total tools available`);

    const messages = [
      { role: 'user', content: buildPrompt(browser) },
    ];

    let finalText = '';
    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await chatCompletion(messages, tools);
      const choice = response.choices?.[0]?.message;
      if (!choice) {
        logError('empty response from OpenRouter.');
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
        log(`[tool] ${name} args=${JSON.stringify(args).slice(0, 500)}`);
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
          logError(`[tool] ${name} FAILED after ${duration}s: ${err.message}`);
          result = `TOOL ERROR: ${err.message}`;
        }
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        log(`[tool] ${name} done in ${duration}s (result ${String(result).length} chars)`);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: String(result).slice(0, 200000),
        });
      }
    }

    log('finished');

    archiveSummary(browser, model);

    if (!finalText.includes('CI_STATUS=PASS')) {
      logError('CI_STATUS is not PASS.');
      return 2;
    }

    return 0;
  } catch (err) {
    logError(`run failed: ${err.message}`);
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

async function chatCompletion(messages, tools) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 500)}`);
  }

  return res.json();
}

function buildPrompt(browser) {
  return `Sei in CI Azure, senza operatore umano. Esegui i test E2E di questo repository.

Browser obbligatorio per questa run: ${browser}

Hai accesso a questi gruppi di tool MCP (prefisso nel nome del tool):
- filesystem__: leggi/scrivi file del repository (working directory: ${process.cwd()})
- shell__: esegui comandi nel terminale (es. shell__start_terminal_process, shell__interact_with_process)
- playwright__: automazione browser ${browser} (snapshot, click, type, screenshot, ecc.)

Regole:
1. Leggi AGENTS.md con un tool filesystem e rispettane tutte le regole (report, screenshot solo sui bug, italiano, cleanup).
2. Usa SOLO launcher-ci.yaml (ignora launcher.yaml). Leggilo con un tool filesystem.
3. Esegui i test con action: run. Salta quelli con skip. Se un test ha action: only, esegui solo quello.
4. Usa i tool playwright__ per il browser ${browser}: profilo isolato, headless, viewport da config.viewport del launcher.
5. Chiudi cookie banner / popup / overlay upsell come da istruzioni.
6. Scrivi i report in reports/ con la struttura richiesta dalle istruzioni (usa i tool filesystem per creare i file). Nel report indica chiaramente: browser (${browser}) e modello AI (${model}). Includi gli screenshot come immagini markdown ![descrizione](reports/<cartella>/screenshot-XXX.png), MAI come semplici path testuali. Indica l'esito di ogni test come PASS o FAIL.
7. Alla fine crea DUE file:
   a) reports/ci-summary.md con: browser (${browser}), modello AI (${model}), data, test eseguiti (uno per riga con esito PASS o FAIL), esito complessivo, path dei report, path degli screenshot, conteggio bug HIGH/MEDIUM/LOW.
   b) reports/ci-data.json con ESATTAMENTE questo schema JSON (valido, nessun testo extra):
      {
        "browser": "${browser}",
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

function archiveSummary(browser, model) {
  const source = 'reports/ci-summary.md';
  const target = `reports/ci-summary-${browser}.md`;
  if (existsSync(source)) {
    renameSync(source, target);
    // Metadata deterministico (non dipende dall'agente AI) per il rendering HTML.
    appendFileSync(
      target,
      `\n---\n\n## Metadata Run\n\n**Browser:** ${browser}\n**Modello AI:** ${model}\n**Timestamp:** ${new Date().toISOString()}\n`,
      'utf8',
    );
    console.log(`Saved ${target}`);
  }

  // Dati strutturati per rendering HTML e email (niente parsing regex del markdown).
  const jsonSource = 'reports/ci-data.json';
  const jsonTarget = `reports/ci-data-${browser}.json`;
  if (existsSync(jsonSource)) {
    renameSync(jsonSource, jsonTarget);
    try {
      const data = JSON.parse(readFileSync(jsonTarget, 'utf8'));
      // Override deterministico dei campi chiave.
      data.browser = browser;
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
