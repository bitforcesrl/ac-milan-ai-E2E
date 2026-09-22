import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const require = createRequire(import.meta.url);
const { E2E_TESTS, BROWSERS, VIEWPORTS, PATHS } = require('../config.js');

// ============================================================================
// 1. CONFIGURAZIONE & ENV PARSING
// ============================================================================

function parseBoolEnv(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.trim().toLowerCase() === 'true';
}

function parseNumEnv(key, fallback, min = -Infinity) {
  const val = Number(process.env[key]);
  return !Number.isNaN(val) && val >= min ? val : fallback;
}

function testEnvKey(testId) {
  return `E2E_TEST_${testId.replace(/-/g, '_').toUpperCase()}`;
}

function selectTests() {
  const pipelineFlags = E2E_TESTS.map((test) => ({
    test,
    envKey: testEnvKey(test.id),
  })).filter(({ envKey }) => process.env[envKey] !== undefined);

  if (pipelineFlags.length) {
    const selected = pipelineFlags
      .filter(({ envKey }) => parseBoolEnv(envKey, false))
      .map(({ test }) => test);

    if (!selected.length) {
      throw new Error('Nessun test selezionato dai parametri della pipeline.');
    }
    return selected;
  }

  const enabled = E2E_TESTS.filter((test) => test.enabled);
  if (!enabled.length) {
    throw new Error('Nessun test abilitato: nessun test con enabled: true in config.js.');
  }
  return enabled;
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

  // Browser e viewport definiti in config.js (unica fonte di verita')
  const browsers = BROWSERS.filter((b) => parseBoolEnv(b.envKey, b.default)).map((b) => b.id);

  if (!browsers.length) {
    throw new Error(
      `Nessun browser selezionato (${BROWSERS.map((b) => b.envKey).join(' / ')}).`,
    );
  }

  const viewports = VIEWPORTS.filter((v) => parseBoolEnv(v.envKey, v.default)).map((v) => v.id);

  if (!viewports.length) {
    throw new Error(
      `Nessun viewport selezionato (${VIEWPORTS.map((v) => v.envKey).join(' / ')}).`,
    );
  }

  return {
    apiKey,
    model,
    maxRetries: parseNumEnv('OPENROUTER_MAX_RETRIES', 5, 1),
    retryBaseMs: parseNumEnv('OPENROUTER_RETRY_BASE_MS', 2000, 100),
    maxTurns: parseNumEnv('OPENROUTER_MAX_TURNS', 300, 1),
    mcpToolTimeout: parseNumEnv('MCP_TOOL_TIMEOUT', 180000, 1000),
    maxParallelSessions: parseNumEnv('MAX_PARALLEL_SESSIONS', 1, 1),
    browsers,
    viewports,
    tests: selectTests(),
  };
}

// ============================================================================
// 2. MAIN & WORKER POOL
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

  // Unità di esecuzione: browser x viewport x test
  const units = config.browsers.flatMap((browser) =>
    config.viewports.flatMap((viewport) =>
      config.tests.map((test) => ({ browser, viewport, test }))
    )
  );

  console.log(`Browsers: ${config.browsers.join(', ')}`);
  console.log(`Viewports: ${config.viewports.join(', ')}`);
  console.log(`Tests: ${config.tests.map((t) => `${t.id} (${t.name})`).join(', ')}`);
  console.log(`Unità Totali: ${units.length}`);
  console.log(`Sessioni in parallelo: ${config.maxParallelSessions}`);
  console.log(`Cartella run: ${PATHS.reports}/${stamp}\n`);

  let hasFailures = false;
  const resultsByCombo = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < units.length) {
      const unit = units[cursor++];
      const comboKey = `${unit.browser}/${unit.viewport}`;

      console.log(`\n========== E2E: ${unit.browser} @ ${unit.viewport} - test: ${unit.test.id} - Model: ${config.model} ==========\n`);
      
      const exitCode = await runSession(unit, config, stamp);

      if (!resultsByCombo.has(comboKey)) {
        resultsByCombo.set(comboKey, []);
      }
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

  const poolSize = Math.min(config.maxParallelSessions, units.length);
  await Promise.all(Array.from({ length: poolSize }, worker));

  // Aggregazione e generazione dei summary finali
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
// 3. ESECUZIONE SESSIONE AGENTE LLM
// ============================================================================

async function runSession({ browser, viewport, test }, config, stamp) {
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
    console.error(`[${browser}/${test.id}] Errore sessione: ${err.message}`, err);
    return 1;
  } finally {
    if (mcp?.clients) {
      await closeMcpClients(mcp.clients);
    }
  }
}

// ============================================================================
// 4. INTEGRAZIONE MCP (MODEL CONTEXT PROTOCOL)
// ============================================================================

async function initMcpServers(browser) {
  const cwd = process.cwd();
  const serverConfigs = [
    {
      name: 'playwright',
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest', '--headless', '--isolated', '--browser', browser],
      env: { ...process.env, PLAYWRIGHT_MCP_BROWSER: browser, PLAYWRIGHT_MCP_ISOLATED: 'true' },
    },
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', cwd],
    },
    {
      name: 'shell',
      command: 'npx',
      args: ['-y', '@wonderwhy-er/desktop-commander'],
    },
  ];

  const clients = [];
  const tools = [];
  const toolMap = new Map();

  for (const s of serverConfigs) {
    const transport = new StdioClientTransport({ command: s.command, args: s.args, cwd, env: s.env });
    const client = new Client({ name: 'e2e-ci-agent', version: '1.0.0' });

    console.log(`[mcp] Connessione a ${s.name}...`);
    await client.connect(transport);

    const { tools: mcpTools } = await client.listTools();
    for (const t of mcpTools) {
      const exposedName = `${s.name}__${t.name}`;
      tools.push({
        type: 'function',
        function: {
          name: exposedName,
          description: `[${s.name}] ${t.description ?? ''}`,
          parameters: t.inputSchema ?? { type: 'object', properties: {} },
        },
      });
      toolMap.set(exposedName, { client, mcpName: t.name });
    }

    clients.push(client);
    console.log(`[mcp] ${s.name}: ${mcpTools.length} tool caricati`);
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
  console.log(`[tool] ${name} completato in ${duration}s (${String(rawResult).length} chars)`);

  return String(rawResult).slice(0, 200000);
}

async function closeMcpClients(clients) {
  await Promise.allSettled(clients.map((c) => c.close()));
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
      await sleep(config.retryBaseMs * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

// ============================================================================
// 6. REPORTING & METADATI
// ============================================================================

function buildRunStamp() {
  // toISOString() e' sempre in UTC: la dashboard lo converte nel fuso locale dell'utente.
  // "2026-09-22T08:59:24.123Z" -> "2026-09-22_08-59-24"
  // (trattini invece dei due punti per evitare errori di sistema nei path su Windows)
  return new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function computeDurationLabel(stamp) {
  const [datePart, timePart] = stamp.split('_');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, s] = timePart.replace(/-/g, ':').split(':').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const totalMin = Math.max(0, Math.round((Date.now() - start.getTime()) / 60000));
  return `${totalMin}m 0s`;
}

function aggregateSessionReports(browser, viewport, config, stamp, results) {
  const sessionDir = `${PATHS.reports}/${stamp}/${browser}/${viewport}`;
  mkdirSync(sessionDir, { recursive: true });

  const testsMeta = [];
  const reportPaths = [];
  const screenshotPaths = [];
  const bugs = { high: 0, medium: 0, low: 0 };

  for (const { test, status } of results) {
    const metaPath = `${sessionDir}/tests/${test.id}.json`;
    let fragment = null;

    if (existsSync(metaPath)) {
      try {
        fragment = JSON.parse(readFileSync(metaPath, 'utf8'));
      } catch (err) {
        console.error(`[report] JSON non valido in ${metaPath}: ${err.message}`);
      }
    }

    // Fallback: se l'agente non ha scritto il fragment (o non e' valido), lo script
    // ne genera uno minimo cosi' ogni test ha SEMPRE il suo report JSON.
    if (!fragment) {
      fragment = {
        schemaVersion: 2,
        test: test.id,
        testName: test.name,
        testFile: test.file,
        browser,
        viewport,
        model: config.model,
        run: stamp,
        status,
        duration: '',
        startedAt: '',
        finishedAt: '',
        summary:
          status === 'PASS'
            ? 'Test completato con successo, ma il report strutturato non e\' stato generato dall\'agente.'
            : 'Test fallito e report strutturato non generato dall\'agente: verificare i log della sessione.',
        steps: [],
        errors: [],
        bugs: [],
        screenshots: [],
        hash: '',
        timestamp: new Date().toISOString(),
      };
      mkdirSync(`${sessionDir}/tests`, { recursive: true });
      writeFileSync(metaPath, JSON.stringify(fragment, null, 2), 'utf8');
      console.warn(`[report] Fragment mancante per ${test.id}: generato fallback in ${metaPath}`);
    }

    reportPaths.push(metaPath);

    for (const shot of fragment.screenshots ?? []) {
      const shotPath = typeof shot === 'string' ? shot : shot?.path;
      if (shotPath && existsSync(shotPath)) screenshotPaths.push(shotPath);
    }

    if (fragment.bugsCount) {
      bugs.high += Number(fragment.bugsCount.high || 0);
      bugs.medium += Number(fragment.bugsCount.medium || 0);
      bugs.low += Number(fragment.bugsCount.low || 0);
    } else if (Array.isArray(fragment.bugs)) {
      for (const b of fragment.bugs) {
        const sev = String(b?.severity || '').toUpperCase();
        if (sev === 'HIGH') bugs.high++;
        else if (sev === 'MEDIUM') bugs.medium++;
        else if (sev === 'LOW') bugs.low++;
      }
    }

    testsMeta.push({
      id: test.id,
      name: test.name,
      status,
      report: metaPath,
    });
  }

  const allPass = testsMeta.length > 0 && testsMeta.every((t) => t.status === 'PASS');

  // Summary di sessione (testo leggibile, equivalente del vecchio summary.md)
  const testsLines = testsMeta
    .map((t) => `- ${t.name}: ${t.status}`)
    .join('\n');
  const summary = [
    `Esito complessivo: ${allPass ? 'PASS' : 'FAIL'}`,
    `Browser: ${browser} | Viewport: ${viewport} | Modello AI: ${config.model}`,
    `Data: ${stamp.slice(0, 10)} ${stamp.slice(11).replace(/-/g, ':')}`,
    `Bug: HIGH ${bugs.high} / MEDIUM ${bugs.medium} / LOW ${bugs.low}`,
    '',
    'Test eseguiti:',
    testsLines,
  ].join('\n');

  // Data della sessione in UTC ISO (derivata dallo stamp UTC)
  const isoDate = `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`;

  const metadata = {
    browser,
    viewport,
    model: config.model,
    run: stamp,
    date: isoDate,
    duration: computeDurationLabel(stamp),
    status: allPass ? 'PASS' : 'FAIL',
    summary,
    tests: testsMeta,
    bugs,
    reportPaths,
    screenshotPaths,
  };

  writeFileSync(`${sessionDir}/metadata.json`, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[report] Salvato ${sessionDir}/metadata.json`);
}

function writeRunMetadata(stamp, config, hasFailures) {
  const runDir = `${PATHS.reports}/${stamp}`;
  mkdirSync(runDir, { recursive: true });

  const sessions = config.browsers.flatMap((browser) =>
    config.viewports.map((viewport) => `${browser}/${viewport}`)
  );

  const data = {
    run: stamp,
    // Data della run in UTC ISO: la dashboard la converte nel fuso locale dell'utente
    date: `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`,
    status: hasFailures ? 'FAIL' : 'PASS',
    sessions,
  };

  writeFileSync(`${runDir}/metadata.json`, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[report] Salvato ${runDir}/metadata.json`);
}

// ============================================================================
// 7. UTILITIES & PROMPT BUILDER
// ============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(browser, viewport, test, model, stamp) {
  const sessionDir = `${PATHS.reports}/${stamp}/${browser}/${viewport}`;

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
6. L'unico output di reportistica e' il JSON strutturato del punto 7.
   Struttura obbligatoria dei file (usa i tool filesystem per creare file e cartelle):
   ${sessionDir}/
     screenshots/             (screenshot della sessione, prefissati con "${test.id}-", es. screenshots/${test.id}-001.png)
     tests/${test.id}.json    (report strutturato del test, creato solo alla fine, punto 7)
   SCREENSHOT: salvali SOLO se trovi bug/anomalie (come da AGENTS.md), prefissati con "${test.id}-".
7. Alla fine crea il report strutturato ${sessionDir}/tests/${test.id}.json con ESATTAMENTE questo schema JSON (valido, nessun testo extra, tutti i testi in italiano):
   {
     "schemaVersion": 2,
     "test": "${test.id}",
     "testName": "${test.name}",
     "testFile": "${test.file}",
     "browser": "${browser}",
     "viewport": "${viewport}",
     "model": "${model}",
     "run": "${stamp}",
     "status": "PASS" | "FAIL",
     "duration": "es. 3m 12s",
     "startedAt": "ISO8601",
     "finishedAt": "ISO8601",
     "summary": "resoconto breve del test in italiano",
     "steps": [
       { "title": "titolo passo", "detail": "dettaglio di cosa e' stato verificato", "status": "PASS" | "FAIL" | "INFO" }
     ],
     "errors": [
       { "message": "messaggio errore (console, network 4xx/5xx, React warning)", "context": "dove/c quando si e' verificato" }
     ],
     "bugs": [
       {
         "id": "BUG-001",
         "severity": "HIGH" | "MEDIUM" | "LOW",
         "title": "titolo breve del bug",
         "description": "descrizione del problema",
         "stepsToReproduce": ["passo 1", "passo 2"],
         "expected": "comportamento atteso",
         "actual": "comportamento osservato",
         "impact": "impatto su utente/sistema",
         "screenshots": ["${sessionDir}/screenshots/${test.id}-001.png"]
       }
     ],
     "screenshots": [
       { "path": "${sessionDir}/screenshots/${test.id}-001.png", "description": "cosa mostra lo screenshot" }
     ],
     "hash": "sha256 esadecimale del contenuto logico del report (calcolato da te sui campi principali, es. test+status+bugs)",
     "timestamp": "ISO8601 della scrittura"
   }
   Regole per il JSON:
   - "steps" deve coprire tutte le fasi del test eseguite (con esito per passo).
   - "errors" elenca errori console/network/React osservati (vuoto se nessuno).
   - "bugs" elenca i bug trovati con severita' (vuoto se nessuno); ogni screenshot citato in un bug DEVE esistere in "screenshots".
   - "screenshots" elenca TUTTI gli screenshot salvati (almeno uno per fase principale del test, SEMPRE) con descrizione.
   - "status" deve riflettere l'esito REALE della verifica: se la condizione richiesta dal test NON e' soddisfatta, lo status e' FAIL
     (es. se il test chiede di verificare la presenza di una voce nel menu e la voce non c'e', lo status e' FAIL).
   - Questo JSON e' l'UNICA fonte per la dashboard dei report: compila ogni campo con cura, non lasciare campi richiesti vuoti se hai i dati.
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, se la condizione del test non e' soddisfatta, oppure se il test non e' completabile.
IMPORTANTE: CI_STATUS deve corrispondere ESATTAMENTE al campo "status" del JSON che hai scritto.`;
}

await main();