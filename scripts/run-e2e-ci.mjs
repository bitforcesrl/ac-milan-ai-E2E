import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ============================================================================
// 1. CONFIGURAZIONE & AMBIENTE
// ============================================================================

function parseBooleanEnv(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).trim().toLowerCase() === 'true';
}

function loadConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('$(')) {
    throw new Error('OPENROUTER_API_KEY mancante o non valida (verificare Azure secrets).');
  }

  const model = process.env.OPENROUTER_AI_MODEL?.trim();
  if (!model) {
    throw new Error('OPENROUTER_AI_MODEL mancante.');
  }

  const browsers = [
    parseBooleanEnv('RUN_CHROMIUM', true) ? 'chromium' : null,
    parseBooleanEnv('RUN_FIREFOX', false) ? 'firefox' : null,
    parseBooleanEnv('RUN_WEBKIT', false) ? 'webkit' : null,
  ].filter(Boolean);

  if (!browsers.length) {
    throw new Error('Nessun browser selezionato (RUN_CHROMIUM / RUN_FIREFOX / RUN_WEBKIT).');
  }

  const viewports = [
    parseBooleanEnv('RUN_DESKTOP', true) ? '1280x650' : null,
    parseBooleanEnv('RUN_TABLET', false) ? '768x1024' : null,
    parseBooleanEnv('RUN_MOBILE', false) ? '390x844' : null,
  ].filter(Boolean);

  if (!viewports.length) {
    throw new Error('Nessun viewport selezionato (RUN_DESKTOP / RUN_TABLET / RUN_MOBILE).');
  }

  return {
    apiKey,
    model,
    maxRetries: Number(process.env.OPENROUTER_MAX_RETRIES || 5),
    retryBaseMs: Number(process.env.OPENROUTER_RETRY_BASE_MS || 2000),
    maxTurns: Number(process.env.OPENROUTER_MAX_TURNS || 300),
    mcpToolTimeout: Number(process.env.MCP_TOOL_TIMEOUT || 180000),
    browsers,
    viewports,
  };
}

// ============================================================================
// 2. ENTRY POINT PRINCIPALE
// ============================================================================

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[CONFIG ERROR] ${err.message}`);
    process.exit(1);
  }

  const stamp = buildRunStamp();
  console.log(`Browsers: ${config.browsers.join(', ')}`);
  console.log(`Viewports: ${config.viewports.join(', ')}`);
  console.log(`Run Totali: ${config.browsers.length * config.viewports.length} (browser x viewport)`);
  console.log(`Cartella run: reports/${stamp}\n`);

  let hasFailures = false;
  const sessions = [];

  for (const browser of config.browsers) {
    for (const viewport of config.viewports) {
      console.log(`\n========== E2E: ${browser} @ ${viewport} - AI Model: ${config.model} ==========\n`);
      const exitCode = await runSession(browser, viewport, config, stamp);
      sessions.push(`${browser}-${viewport}`);
      if (exitCode !== 0) {
        hasFailures = true;
        process.exitCode = Math.max(process.exitCode || 0, exitCode);
      }
    }
  }

  writeRunMetadata(stamp, sessions, hasFailures);

  if (hasFailures) {
    console.error('\n[CI FAIL] Uno o più test/browser hanno fallito.');
  } else {
    console.log('\n[CI SUCCESS] Tutti i test sono terminati con successo.');
  }
}

// ============================================================================
// 3. ESECUZIONE DELLA SINGOLA SESSIONE (BROWSER x VIEWPORT)
// ============================================================================

async function runSession(browser, viewport, config, stamp) {
  let mcp;
  try {
    mcp = await initMcpServers(browser);
    const messages = [{ role: 'user', content: buildPrompt(browser, viewport, config.model, stamp) }];
    let finalText = '';

    for (let turn = 0; turn < config.maxTurns; turn++) {
      const response = await chatCompletion(messages, mcp.tools, config);
      const choice = response.choices?.[0]?.message;

      if (!choice) {
        console.error(`[${browser}] Nessuna risposta ricevuta da OpenRouter.`);
        return 2;
      }

      messages.push(choice);

      if (choice.content) {
        process.stdout.write(choice.content);
        finalText += `\n${choice.content}`;
      }

      const toolCalls = choice.tool_calls ?? [];
      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        const toolResult = await executeToolCall(call, mcp.toolMap, config.mcpToolTimeout);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResult,
        });
      }
    }

    console.log(`\n--- ${browser} @ ${viewport} completato ---`);
    archiveSummary(browser, config.model, viewport, stamp);

    if (!finalText.includes('CI_STATUS=PASS')) {
      console.error(`[${browser}] CI_STATUS non e' PASS.`);
      return 2;
    }

    return 0;
  } catch (err) {
    console.error(`[${browser}] Errore durante l'esecuzione della sessione: ${err.message}`, err);
    return 1;
  } finally {
    if (mcp?.clients) {
      await closeMcpClients(mcp.clients);
    }
  }
}

// ============================================================================
// 4. GESTIONE MCP (MODEL CONTEXT PROTOCOL)
// ============================================================================

async function initMcpServers(browser) {
  const serverConfigs = [
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
  const toolMap = new Map();

  for (const server of serverConfigs) {
    const client = new Client({ name: 'e2e-ci-agent', version: '1.0.0' });
    console.log(`[mcp] Connessione a ${server.name}...`);
    await client.connect(server.transport);
    
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
    console.log(`[mcp] ${server.name}: ${mcpTools.length} tool caricati`);
  }

  console.log(`[mcp] Totale tool disponibili per ${browser}: ${tools.length}`);
  return { clients, tools, toolMap };
}

async function executeToolCall(call, toolMap, timeout) {
  const name = call.function.name;
  let args = {};

  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = {};
  }

  console.log(`[tool] ${name} args=${JSON.stringify(args).slice(0, 500)}`);
  const startedAt = Date.now();
  let rawResult;

  try {
    const entry = toolMap.get(name);
    if (!entry) throw new Error(`Tool sconosciuto: ${name}`);

    const res = await entry.client.callTool(
      { name: entry.mcpName, arguments: args },
      undefined,
      { timeout }
    );

    const parts = Array.isArray(res.content) ? res.content : [];
    rawResult = parts
      .map((p) => {
        if (p.type === 'text') return p.text;
        if (p.type === 'image') return '[image content omitted]';
        return `[${p.type}]`;
      })
      .join('\n') || JSON.stringify(res);

  } catch (err) {
    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[tool] ${name} FALLITO dopo ${duration}s: ${err.message}`);
    rawResult = `TOOL ERROR: ${err.message}`;
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[tool] ${name} completato in ${duration}s (risposta: ${String(rawResult).length} caratteri)`);

  // Tronca i risultati troppo massivi per non saturare il contesto dell'LLM
  return String(rawResult).slice(0, 200000);
}

async function closeMcpClients(clients) {
  for (const client of clients) {
    try {
      await client.close();
    } catch {
      /* Ignora errori in chiusura */
    }
  }
}

// ============================================================================
// 5. CLIENT OPENROUTER (LLM)
// ============================================================================

async function chatCompletion(messages, tools, config) {
  const body = JSON.stringify({
    model: config.model,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0,
  });

  let lastError;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (res.ok) return await res.json();

      const errBody = await res.text();
      const isRetryable = res.status === 429 || res.status >= 500;

      lastError = new Error(`OpenRouter API error ${res.status}: ${errBody.slice(0, 500)}`);

      if (!isRetryable) throw lastError;

      console.warn(`[llm] Tentativo ${attempt}/${config.maxRetries} fallito (HTTP ${res.status}), retrying...`);
    } catch (err) {
      if (err.message?.startsWith('OpenRouter API error') && !err.message.includes('429') && !err.message.includes('500')) {
        throw err;
      }
      lastError = err;
      console.warn(`[llm] Tentativo ${attempt}/${config.maxRetries} fallito (${err.message}), retrying...`);
    }

    if (attempt < config.maxRetries) {
      await sleep(config.retryBaseMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

// ============================================================================
// 6. REPORTING & ARCHIVIAZIONE
// ============================================================================

function buildRunStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// L'agente scrive summary.md e metadata.json direttamente nella cartella della
// sessione (reports/{stamp}/{browser}-{viewport}/); qui li validiamo e arricchiamo.
function archiveSummary(browser, model, viewport, stamp) {
  const sessionDir = `reports/${stamp}/${browser}-${viewport}`;
  mkdirSync(sessionDir, { recursive: true });

  const summaryPath = `${sessionDir}/summary.md`;
  if (!existsSync(summaryPath)) {
    console.error(`[report] Mancante ${summaryPath}`);
  } else {
    console.log(`[report] Trovato ${summaryPath}`);
  }

  const metaPath = `${sessionDir}/metadata.json`;
  if (!existsSync(metaPath)) {
    console.error(`[report] Mancante ${metaPath}`);
    return;
  }

  try {
    const data = JSON.parse(readFileSync(metaPath, 'utf8'));
    data.browser = browser;
    data.viewport = viewport;
    data.model = model;
    data.run = stamp;
    data.timestamp = new Date().toISOString();
    if (data.status !== 'PASS' && data.status !== 'FAIL') data.status = '';

    writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[report] Validato ${metaPath}`);
  } catch (err) {
    console.error(`[report] JSON non valido in ${metaPath}: ${err.message}`);
  }
}

// Metadata di run: aggrega lo stato complessivo delle sessioni della run
function writeRunMetadata(stamp, sessions, hasFailures) {
  const runDir = `reports/${stamp}`;
  mkdirSync(runDir, { recursive: true });

  const data = {
    run: stamp,
    date: stamp.slice(0, 10),
    time: stamp.slice(11),
    status: hasFailures ? 'FAIL' : 'PASS',
    sessions,
  };

  writeFileSync(`${runDir}/metadata.json`, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[report] Salvato ${runDir}/metadata.json`);
}

// ============================================================================
// 7. UTILITIES & PROMPT
// ============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(browser, viewport, model, stamp) {
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
6. Struttura obbligatoria dei report (usa i tool filesystem per creare file e cartelle):
   reports/${stamp}/${browser}-${viewport}/
     summary.md          (creato solo alla fine, punto 7)
     metadata.json       (creato solo alla fine, punto 7)
     <nome-test>.md      (un file .md per ogni test eseguito, stesso nome del file di test, es. pdp.test.md -> pdp.test.md)
     screenshots/        (tutti gli screenshot della sessione)
   Nel report di ogni test indica chiaramente: browser (${browser}), viewport (${viewport}) e modello AI (${model}). Includi gli screenshot come immagini markdown ![descrizione](reports/${stamp}/${browser}-${viewport}/screenshots/screenshot-XXX.png), MAI come semplici path testuali. Indica l'esito di ogni test come PASS o FAIL.
7. Alla fine crea DUE file dentro reports/${stamp}/${browser}-${viewport}/:
   a) summary.md con: browser (${browser}), viewport (${viewport}), modello AI (${model}), data, test eseguiti (uno per riga con esito PASS o FAIL), esito complessivo, path dei report, path degli screenshot, conteggio bug HIGH/MEDIUM/LOW.
   b) metadata.json con ESATTAMENTE questo schema JSON (valido, nessun testo extra):
      {
        "browser": "${browser}",
        "viewport": "${viewport}",
        "model": "${model}",
        "run": "${stamp}",
        "date": "YYYY-MM-DD",
        "duration": "es. 12m 30s",
        "status": "PASS" | "FAIL",
        "tests": [{ "name": "pdp.test.md", "status": "PASS" | "FAIL", "report": "reports/${stamp}/${browser}-${viewport}/<nome-test>.md" }],
        "bugs": { "high": 0, "medium": 0, "low": 0 },
        "reportPaths": ["reports/${stamp}/${browser}-${viewport}/..."],
        "screenshotPaths": ["reports/${stamp}/${browser}-${viewport}/screenshots/..."]
      }
      "tests" contiene SOLO i test eseguiti (action run/only), non quelli saltati. OGNI elemento di "tests" DEVE avere "name" (nome del file di test), "status" (PASS o FAIL) e "report" (path completo del report .md del test, stringa vuota solo se il report non esiste). Questi dati sono l'unica fonte per il rendering dei report: non trascurarli.
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, oppure se un test non e' completabile.`;
}

// Avvio
await main();