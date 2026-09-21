import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { E2E_TESTS, PATHS } = require('../config.js');
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

  const tests = selectTests(process.env.TESTS_ENABLED);

  return {
    apiKey,
    model,
    maxRetries: Number(process.env.OPENROUTER_MAX_RETRIES || 5),
    retryBaseMs: Number(process.env.OPENROUTER_RETRY_BASE_MS || 2000),
    maxTurns: Number(process.env.OPENROUTER_MAX_TURNS || 300),
    mcpToolTimeout: Number(process.env.MCP_TOOL_TIMEOUT || 180000),
    maxParallelSessions: Math.max(1, Number(process.env.MAX_PARALLEL_SESSIONS || 1)),
    browsers,
    viewports,
    tests,
  };
}

// Selezione test:
// - Se TESTS_ENABLED e' definita (lista di id separati da virgole), vengono eseguiti
//   SOLO i test con quegli id (override del campo enabled di config.js)
// - Altrimenti vengono eseguiti i test con enabled: true
function selectTests(raw) {
  if (raw === undefined || raw.trim() === '') {
    const byEnabled = E2E_TESTS.filter((t) => t.enabled === true);
    if (!byEnabled.length) {
      throw new Error('Nessun test selezionato: TESTS_ENABLED non definita e nessun test con enabled: true in config.js.');
    }
    return byEnabled;
  }

  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  if (!ids.length) {
    throw new Error('Nessun test selezionato in TESTS_ENABLED.');
  }

  const unknown = ids.filter((id) => !E2E_TESTS.some((t) => t.id === id));
  if (unknown.length) {
    const valid = E2E_TESTS.map((t) => t.id).join(', ');
    throw new Error(`Id test sconosciuti in TESTS_ENABLED: ${unknown.join(', ')} (id validi: ${valid})`);
  }

  const seen = new Set();
  return ids
    .map((id) => {
      if (seen.has(id)) return null;
      seen.add(id);
      return E2E_TESTS.find((t) => t.id === id);
    })
    .filter(Boolean);
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

  // Unità di esecuzione: una per (browser x viewport x test).
  // Ogni unità ha la sua conversazione LLM, i suoi server MCP e il suo browser
  // isolato, quindi può girare in parallelo con le altre.
  const units = config.browsers.flatMap((browser) =>
    config.viewports.flatMap((viewport) =>
      config.tests.map((test) => ({ browser, viewport, test }))
    )
  );

  console.log(`Browsers: ${config.browsers.join(', ')}`);
  console.log(`Viewports: ${config.viewports.join(', ')}`);
  console.log(`Tests: ${config.tests.map((t) => `${t.id} (${t.name})`).join(', ')}`);
  console.log(`Unità Totali: ${units.length} (browser x viewport x test)`);
  console.log(`Sessioni in parallelo: ${config.maxParallelSessions}`);
  console.log(`Cartella run: ${PATHS.raw}/${stamp}\n`);

  let hasFailures = false;
  // Risultati per combinazione browser/viewport: "browser/viewport" -> [{ test, status }]
  const resultsByCombo = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < units.length) {
      const unit = units[cursor++];
      const comboKey = `${unit.browser}/${unit.viewport}`;
      console.log(`\n========== E2E: ${unit.browser} @ ${unit.viewport} - test: ${unit.test.id} - AI Model: ${config.model} ==========\n`);
      const exitCode = await runSession(unit.browser, unit.viewport, unit.test, config, stamp);
      if (!resultsByCombo.has(comboKey)) resultsByCombo.set(comboKey, []);
      resultsByCombo.get(comboKey).push({
        test: unit.test,
        status: exitCode === 0 ? 'PASS' : 'FAIL',
      });
      if (exitCode !== 0) {
        hasFailures = true;
        process.exitCode = Math.max(process.exitCode || 0, exitCode);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(config.maxParallelSessions, units.length) },
    () => worker()
  );
  await Promise.all(workers);

  // Aggregazione: per ogni combinazione browser/viewport generiamo summary.md e
  // metadata.json a partire dai risultati delle singole unità di test.
  for (const browser of config.browsers) {
    for (const viewport of config.viewports) {
      const comboKey = `${browser}/${viewport}`;
      const results = resultsByCombo.get(comboKey) ?? [];
      aggregateSessionReports(browser, viewport, config, stamp, results);
    }
  }

  writeRunMetadata(stamp, config, hasFailures);

  if (hasFailures) {
    console.error('\n[CI FAIL] Uno o più test/browser hanno fallito.');
  } else {
    console.log('\n[CI SUCCESS] Tutti i test sono terminati con successo.');
  }
}

// ============================================================================
// 3. ESECUZIONE DELLA SINGOLA SESSIONE (BROWSER x VIEWPORT x TEST)
// ============================================================================

async function runSession(browser, viewport, test, config, stamp) {
  let mcp;
  try {
    mcp = await initMcpServers(browser);
    const messages = [{ role: 'user', content: buildPrompt(browser, viewport, test, config.model, stamp) }];
    let finalText = '';

    for (let turn = 0; turn < config.maxTurns; turn++) {
      const response = await chatCompletion(messages, mcp.tools, config);
      const choice = response.choices?.[0]?.message;

      if (!choice) {
        console.error(`[${browser}/${test.id}] Nessuna risposta ricevuta da OpenRouter.`);
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

    console.log(`\n--- ${browser} @ ${viewport} - ${test.id} completato ---`);

    if (!finalText.includes('CI_STATUS=PASS')) {
      console.error(`[${browser}/${test.id}] CI_STATUS non e' PASS.`);
      return 2;
    }

    return 0;
  } catch (err) {
    console.error(`[${browser}/${test.id}] Errore durante l'esecuzione della sessione: ${err.message}`, err);
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

// Ogni unità di test scrive il proprio report .md, gli screenshot e un fragment
// metadata in reports/raw/{stamp}/{browser}/{viewport}/meta/<test-id>.json.
// Qui, a run conclusa, aggregiamo i fragment in summary.md e metadata.json
// per ogni combinazione browser/viewport (schema identico a quello precedente).
function aggregateSessionReports(browser, viewport, config, stamp, results) {
  const sessionDir = `${PATHS.raw}/${stamp}/${browser}/${viewport}`;
  mkdirSync(sessionDir, { recursive: true });

  const testsMeta = [];
  const reportPaths = [];
  const screenshotPaths = [];
  const bugs = { high: 0, medium: 0, low: 0 };

  for (const { test, status } of results) {
    const metaPath = `${sessionDir}/meta/${test.id}.json`;
    let fragment = null;
    try {
      if (existsSync(metaPath)) {
        fragment = JSON.parse(readFileSync(metaPath, 'utf8'));
      }
    } catch (err) {
      console.error(`[report] JSON non valido in ${metaPath}: ${err.message}`);
    }

    const reportPath = fragment?.report || `${sessionDir}/${test.file.split('/').pop()}`;
    if (existsSync(reportPath)) reportPaths.push(reportPath);

    for (const shot of fragment?.screenshotPaths ?? []) {
      if (existsSync(shot)) screenshotPaths.push(shot);
    }

    if (fragment?.bugs) {
      bugs.high += Number(fragment.bugs.high || 0);
      bugs.medium += Number(fragment.bugs.medium || 0);
      bugs.low += Number(fragment.bugs.low || 0);
    }

    testsMeta.push({
      name: test.file.split('/').pop(),
      status,
      report: existsSync(reportPath) ? reportPath : '',
    });
  }

  const allPass = testsMeta.length > 0 && testsMeta.every((t) => t.status === 'PASS');
  const duration = computeDurationLabel(stamp);

  const metadata = {
    browser,
    viewport,
    model: config.model,
    run: stamp,
    date: stamp.slice(0, 10),
    duration,
    status: allPass ? 'PASS' : 'FAIL',
    tests: testsMeta,
    bugs,
    reportPaths,
    screenshotPaths,
  };
  writeFileSync(`${sessionDir}/metadata.json`, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[report] Salvato ${sessionDir}/metadata.json`);

  const testsLines = testsMeta
    .map((t) => `- ${t.name}: ${t.status}${t.report ? ` (report: ${t.report})` : ' (report mancante)'}`)
    .join('\n');

  const summary = `# Summary E2E — ${browser} @ ${viewport}

- **Browser:** ${browser}
- **Viewport:** ${viewport}
- **Modello AI:** ${config.model}
- **Data:** ${stamp.slice(0, 10)} ${stamp.slice(11)}
- **Esito complessivo:** ${allPass ? 'PASS' : 'FAIL'}
- **Bug:** HIGH ${bugs.high} / MEDIUM ${bugs.medium} / LOW ${bugs.low}

## Test eseguiti
${testsLines}

## Report
${reportPaths.length ? reportPaths.map((p) => `- ${p}`).join('\n') : '- (nessun report trovato)'}

## Screenshot
${screenshotPaths.length ? screenshotPaths.map((p) => `- ${p}`).join('\n') : '- (nessuno screenshot salvato)'}
`;
  writeFileSync(`${sessionDir}/summary.md`, summary, 'utf8');
  console.log(`[report] Salvato ${sessionDir}/summary.md`);
}

// Stima della durata della run: dallo stamp di inizio a ora (approssimata al minuto)
function computeDurationLabel(stamp) {
  const [datePart, timePart] = stamp.split('_');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, s] = timePart.split(':').map(Number);
  const start = new Date(y, mo - 1, d, h, mi, s);
  const totalMin = Math.max(0, Math.round((Date.now() - start.getTime()) / 60000));
  return `${totalMin}m 0s`;
}

// Metadata di run: aggrega lo stato complessivo delle sessioni della run
function writeRunMetadata(stamp, config, hasFailures) {
  const runDir = `${PATHS.raw}/${stamp}`;
  mkdirSync(runDir, { recursive: true });

  const sessions = config.browsers.flatMap((browser) =>
    config.viewports.map((viewport) => `${browser}/${viewport}`)
  );

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

function buildPrompt(browser, viewport, test, model, stamp) {
  const sessionDir = `${PATHS.raw}/${stamp}/${browser}/${viewport}`;
  const testFileName = test.file.split('/').pop();

  return `Sei in CI Azure, senza operatore umano. Esegui UN SOLO test E2E di questo repository.

Browser obbligatorio per questa run: ${browser}
Viewport obbligatorio per questa run: ${viewport} (usa browser_resize con width/height corrispondenti PRIMA di navigare, e rispettalo per tutto il test)

Hai accesso a questi gruppi di tool MCP (prefisso nel nome del tool):
- filesystem__: leggi/scrivi file del repository (working directory: ${process.cwd()})
- shell__: esegui comandi nel terminale (es. shell__start_terminal_process, shell__interact_with_process)
- playwright__: automazione browser ${browser} (snapshot, click, type, screenshot, ecc.)

Regole:
1. Leggi AGENTS.md con un tool filesystem e rispettane tutte le regole (report, screenshot solo sui bug, italiano, cleanup).
2. Il test di questa run e' UNO SOLO (definizioni in config.js). NON eseguire altri test.
   - id: ${test.id} | name: ${test.name} | file: ${test.file} | url: ${test.url}${test.notes ? ` | note: ${test.notes} (applica questa nota con priorita')` : ''}
3. Esegui il test: naviga all'url indicato, leggi le istruzioni dal file "tests/${test.file}" con un tool filesystem e applicale.
4. Usa i tool playwright__ per il browser ${browser}: profilo isolato, headless, viewport ${viewport} (rispettalo per tutta la run).
5. Chiudi cookie banner / popup / overlay upsell come da istruzioni.
6. Struttura obbligatoria dei report (usa i tool filesystem per creare file e cartelle):
   ${sessionDir}/
     ${testFileName}          (report del test, stesso nome del file di test)
     screenshots/             (screenshot della sessione, prefissati con "${test.id}-", es. screenshots/${test.id}-001.png)
     meta/${test.id}.json     (fragment metadata, creato solo alla fine, punto 7)
   Nel report indica chiaramente: browser (${browser}), viewport (${viewport}) e modello AI (${model}). Includi gli screenshot come immagini markdown ![descrizione](${sessionDir}/screenshots/${test.id}-XXX.png), MAI come semplici path testuali. Indica l'esito del test come PASS o FAIL.
   NON creare summary.md ne' metadata.json: li genera lo script aggregando i risultati di tutti i test.
7. Alla fine crea il fragment metadata ${sessionDir}/meta/${test.id}.json con ESATTAMENTE questo schema JSON (valido, nessun testo extra):
   {
     "test": "${test.id}",
     "browser": "${browser}",
     "viewport": "${viewport}",
     "model": "${model}",
     "run": "${stamp}",
     "status": "PASS" | "FAIL",
     "bugs": { "high": 0, "medium": 0, "low": 0 },
     "report": "${sessionDir}/${testFileName}",
     "screenshotPaths": ["${sessionDir}/screenshots/${test.id}-001.png"]
   }
   "report" e' il path del report .md del test (stringa vuota solo se non esiste). "screenshotPaths" elenca gli screenshot salvati (solo se hai trovato bug/anomalie). Questi dati sono l'unica fonte per il rendering dei report: non trascurarli.
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, oppure se il test non e' completabile.`;
}

// Avvio
await main();
