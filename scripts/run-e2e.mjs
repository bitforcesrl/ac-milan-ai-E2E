import 'dotenv/config';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { E2E_TESTS, BROWSERS, VIEWPORTS, AI_MODELS, MAX_PARALLEL_SESSIONS, PATHS } = await jiti.import('../config.ts');
import {
  RUN_INDEX_FILE,
  buildRunIndexEntry,
  parseRunIndex,
  readRunIndexFile,
  upsertRunIndex,
  writeRunIndexFile,
} from './run-index.mjs';

// ============================================================================
// 1. CONFIGURAZIONE: run config per-flusso (configs/*.config.json)
// ============================================================================
//
// La run config (test, browser, viewport, modello AI, parallelismo, note) NON
// passa piu' da variabili d'ambiente E2E_*: arriva da un file JSON validato.
// Sorgente: flag CLI --config <path> (usato da azure-pipelines.yml e
// package.json); in assenza del flag viene usato configs/local.config.json.
//
// Schema identico a src/lib/run-config-schema.ts (Zod), validato qui contro il
// catalogo in config.ts.

const DEFAULT_CONFIG_PATH = 'configs/local.config.json';

function resolveConfigPath() {
  const cliIndex = process.argv.indexOf('--config');
  if (cliIndex !== -1 && process.argv[cliIndex + 1]) {
    return process.argv[cliIndex + 1];
  }
  return DEFAULT_CONFIG_PATH;
}

function loadRunConfigFile() {
  const configPath = resolveConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`Run config non trovata: ${configPath}`);
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Run config non e' JSON valido (${configPath}): ${err.message}`);
  }

  return { configPath, raw };
}

/**
 * Valida la run config grezza contro lo schema (stesso contratto di
 * src/lib/run-config-schema.ts) e contro il catalogo in config.ts.
 * Ritorna la config normalizzata o solleva un errore descrittivo.
 */
function validateRunConfig(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Run config non valida: atteso un oggetto JSON.');
  }

  // --- tests ---
  if (!Array.isArray(raw.tests) || raw.tests.length === 0) {
    errors.push('tests: selezionare almeno un test.');
  } else {
    const testIds = new Set(E2E_TESTS.map((t) => t.id));
    raw.tests.forEach((t, i) => {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !t.id) {
        errors.push(`tests[${i}]: id mancante o non valido.`);
      } else if (!testIds.has(t.id)) {
        errors.push(`tests[${i}]: test sconosciuto "${t.id}".`);
      }
      if (t?.notes !== undefined && typeof t.notes !== 'string') {
        errors.push(`tests[${i}].notes: deve essere una stringa.`);
      }
    });
  }

  // --- browsers ---
  if (!Array.isArray(raw.browsers) || raw.browsers.length === 0) {
    errors.push('browsers: selezionare almeno un browser.');
  } else {
    const browserIds = new Set(BROWSERS.map((b) => b.id));
    for (const b of raw.browsers) {
      if (!browserIds.has(b)) errors.push(`browsers: browser sconosciuto "${b}".`);
    }
  }

  // --- viewports ---
  if (!Array.isArray(raw.viewports) || raw.viewports.length === 0) {
    errors.push('viewports: selezionare almeno un viewport.');
  } else {
    const viewportIds = new Set(VIEWPORTS.map((v) => v.id));
    for (const v of raw.viewports) {
      if (!viewportIds.has(v)) errors.push(`viewports: viewport sconosciuto "${v}".`);
    }
  }

  // --- aiModel ---
  if (typeof raw.aiModel !== 'string' || !raw.aiModel) {
    errors.push('aiModel: mancante o non valido.');
  } else if (!AI_MODELS.includes(raw.aiModel)) {
    errors.push(`aiModel: modello non disponibile "${raw.aiModel}".`);
  }

  // --- maxParallelSessions ---
  const parallel = Number(raw.maxParallelSessions);
  if (!MAX_PARALLEL_SESSIONS.options.includes(parallel)) {
    errors.push(
      `maxParallelSessions: valore non valido (ammessi: ${MAX_PARALLEL_SESSIONS.options.join(', ')}).`,
    );
  }

  if (errors.length) {
    throw new Error(`Run config non valida: ${errors.join(' ')}`);
  }

  // Risoluzione dei test selezionati contro il catalogo, con override note
  const testsById = new Map(E2E_TESTS.map((t) => [t.id, t]));
  return {
    tests: raw.tests.map(({ id, notes }) => {
      const catalogTest = testsById.get(id);
      const note = notes?.trim();
      return note ? { ...catalogTest, notes: note } : catalogTest;
    }),
    browsers: [...raw.browsers],
    viewports: [...raw.viewports],
    model: raw.aiModel,
    maxParallelSessions: parallel,
  };
}

function loadConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('$(')) {
    throw new Error('OPENROUTER_API_KEY mancante o non valida (verificare Azure secrets).');
  }

  const { configPath, raw } = loadRunConfigFile();
  const runConfig = validateRunConfig(raw);

  return {
    apiKey,
    configPath,
    maxRetries: Number(process.env.OPENROUTER_MAX_RETRIES) >= 1
      ? Number(process.env.OPENROUTER_MAX_RETRIES)
      : 5,
    retryBaseMs: 2000,
    maxTurns: Number(process.env.OPENROUTER_MAX_TURNS) >= 1
      ? Number(process.env.OPENROUTER_MAX_TURNS)
      : 300,
    mcpToolTimeout: 180000,
    ...runConfig,
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

  console.log(`Run config: ${config.configPath}`);
  console.log(`Browsers: ${config.browsers.join(', ')}`);
  console.log(`Viewports: ${config.viewports.join(', ')}`);
  console.log(`Tests: ${config.tests.map((t) => `${t.id} (${t.name})`).join(', ')}`);
  console.log(`Unità Totali: ${units.length}`);
  console.log(`Sessioni in parallelo: ${config.maxParallelSessions}`);
  console.log(`Cartella run: ${PATHS.reports}/${stamp}\n`);

  let hasFailures = false;
  const sessionMetas = [];
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
      const meta = await aggregateSessionReports(browser, viewport, config, stamp, results);
      if (meta) sessionMetas.push(meta);
    }
  }

  writeRunMetadata(stamp, config, hasFailures, sessionMetas);
  updateRunsIndex(stamp, config, hasFailures, sessionMetas);

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
  let sessionCost = 0;
  try {
    mcp = await initMcpServers(browser);
    const messages = [{ role: 'user', content: buildPrompt(browser, viewport, test, config.model, stamp) }];
    let finalText = '';

    for (let turn = 0; turn < config.maxTurns; turn++) {
      const response = await chatCompletion(messages, mcp.tools, config);
      const choice = response.choices?.[0]?.message;

      // Costo della singola chiamata (USD), fornito da OpenRouter con usage: { include: true }
      const callCost = Number(response.usage?.cost);
      if (Number.isFinite(callCost) && callCost > 0) {
        sessionCost += callCost;
      }

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
    // Costo AI della sessione (USD): aggiunto ai metadati TEMPORANEI per-test
    // scritti dall'agente, così l'aggregazione lo raccoglie come gli altri campi.
    writeTestCost(stamp, browser, viewport, test.id, sessionCost);
    if (mcp?.clients) {
      await closeMcpClients(mcp.clients);
    }
  }
}

/**
 * Aggiunge il campo "cost" (USD) ai metadati temporanei per-test
 * `${sessionDir}/metadata/<test-id>.json` scritti dall'agente.
 * Il file viene poi aggregato nel metadata.json di sessione e cancellato.
 */
function writeTestCost(stamp, browser, viewport, testId, cost) {
  const path = `${PATHS.reports}/${stamp}/${browser}/${viewport}/metadata/${testId}.json`;
  if (!existsSync(path)) return;
  try {
    const meta = JSON.parse(readFileSync(path, 'utf8'));
    meta.cost = roundCost(cost);
    writeFileSync(path, JSON.stringify(meta, null, 2), 'utf8');
    console.log(`[report] Costo AI ${meta.cost} USD registrato in ${path}`);
  } catch (err) {
    console.warn(`[report] Impossibile registrare il costo AI in ${path}: ${err.message}`);
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
  // Con tools vuoti (chiamate di puro testo, es. summary di sessione) li omettiamo.
  // usage.include: true -> OpenRouter include usage e costo (usage.cost, USD) nella risposta.
  const body = JSON.stringify({
    model: config.model,
    messages,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
    temperature: 0,
    usage: { include: true },
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

/**
 * Genera il resoconto della sessione con una chiamata LLM dedicata (nessun tool):
 * sintetizza esito, bug e summary per-test in un testo conciso per la dashboard.
 * Ritorna { text, cost } dove cost (USD) e' il costo della chiamata LLM da
 * sommare al costo di sessione; text e' null in caso di errore/risposta vuota
 * (il chiamante applica il fallback).
 */
async function generateAiSessionSummary(browser, viewport, config, stamp, testsMeta, perTestMetas, bugs) {
  const testsInput = testsMeta
    .map((t) => {
      const pt = perTestMetas.get(t.id);
      const b = pt?.bugs ?? {};
      return `- ${t.name} (${t.status}) | bug HIGH ${b.high ?? 0} / MEDIUM ${b.medium ?? 0} / LOW ${b.low ?? 0}\n  resoconto test: ${pt?.summary?.trim() || 'non disponibile'}`;
    })
    .join('\n');

  const messages = [{
    role: 'user',
    content: `Sei un responsabile QA. Scrivi un resoconto conciso (massimo 5 righe, in italiano) di questa sessione di test E2E per la dashboard dei report.
Dati della sessione:
- Browser: ${browser} | Viewport: ${viewport} | Run: ${stamp} | Modello: ${config.model}
- Bug totali: HIGH ${bugs.high} / MEDIUM ${bugs.medium} / LOW ${bugs.low}
- Test eseguiti:
${testsInput}

Requisiti: evidenzia l'esito complessivo, i problemi piu' gravi trovati (con severita') e un giudizio sintetico sulla qualita' del flusso testato. Solo il resoconto, nessun preambolo ne' elenco strutturale dei test.`,
  }];

  try {
    const res = await chatCompletion(messages, [], config);
    const text = res.choices?.[0]?.message?.content?.trim();
    const cost = Number(res.usage?.cost);
    if (!text) {
      console.warn('[report] Summary AI di sessione vuoto: uso il fallback.');
      return { text: null, cost: Number.isFinite(cost) ? cost : 0 };
    }
    return { text, cost: Number.isFinite(cost) ? cost : 0 };
  } catch (err) {
    console.warn(`[report] Summary AI di sessione fallito: ${err.message}. Uso il fallback.`);
    return { text: null, cost: 0 };
  }
}

/**
 * Legge i metadati TEMPORANEI per-test scritti dall'agente in
 * `${sessionDir}/metadata/<test-id>.json`. Ogni sessione agent scrive il SUO file
 * (path deterministico, nessuna sovrascrittura tra test della stessa combo):
 * dopo l'aggregazione nel metadata.json di sessione la cartella viene cancellata.
 * Ritorna una Map test-id -> metadata parsato (solo JSON validi con "id").
 */
function readPerTestMetas(sessionDir) {
  const dir = `${sessionDir}/metadata`;
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      if (parsed?.id) byId.set(parsed.id, parsed);
    } catch (err) {
      console.error(`[report] JSON non valido in ${dir}/${f}: ${err.message}`);
    }
  }
  return byId;
}

async function aggregateSessionReports(browser, viewport, config, stamp, results) {
  const sessionDir = `${PATHS.reports}/${stamp}/${browser}/${viewport}`;
  mkdirSync(sessionDir, { recursive: true });

  // Metadati TEMPORANEI per-test scritti da ogni sessione agent (fonte primaria
  // per i bug counts: un file per test, nessuna sovrascrittura). Verranno
  // cancellati dopo l'aggregazione nel metadata.json di sessione.
  const perTestMetas = readPerTestMetas(sessionDir);

  // I metadati di sessione sono generati DIRETTAMENTE dall'agente AI
  // (metadata.json strutturato, nessun parsing del Markdown).
  const metaPath = `${sessionDir}/metadata.json`;
  let meta = null;
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (err) {
      console.error(`[report] JSON non valido in ${metaPath}: ${err.message}`);
    }
  }

  // Fallback: se l'agente non ha scritto i metadati (o non sono validi), lo
  // script ne genera uno minimo usando lo status osservato dalla CI.
  if (!meta) {
    const testsMeta = [];
    const reportPaths = [];
    const screenshotPaths = [];
    for (const { test, status } of results) {
      const reportPath = `${sessionDir}/tests/${test.id}.md`;

      // Fallback: se l'agente non ha scritto il report Markdown, lo script ne
      // genera uno minimo cosi' ogni test ha SEMPRE il suo report .md.
      if (!existsSync(reportPath)) {
        const fallback = [
          `# Report test: ${test.name}`,
          '',
          `- **Test:** ${test.id} (${test.file})`,
          `- **Browser:** ${browser} | **Viewport:** ${viewport} | **Modello AI:** ${config.model}`,
          `- **Run:** ${stamp}`,
          `- **Status:** ${status}`,
          '',
          status === 'PASS'
            ? 'Test completato con successo, ma il report Markdown non e\' stato generato dall\'agente.'
            : 'Test fallito e report Markdown non generato dall\'agente: verificare i log della sessione.',
          '',
        ].join('\n');
        mkdirSync(`${sessionDir}/tests`, { recursive: true });
        writeFileSync(reportPath, fallback, 'utf8');
        console.warn(`[report] Report mancante per ${test.id}: generato fallback in ${reportPath}`);
      }

      reportPaths.push(reportPath);

      // Screenshot della sessione: file in screenshots/ prefissati con "<test-id>-"
      const shotsDir = `${sessionDir}/screenshots`;
      if (existsSync(shotsDir)) {
        for (const f of readdirSync(shotsDir)) {
          if (f.startsWith(`${test.id}-`)) {
            screenshotPaths.push(`${shotsDir}/${f}`);
          }
        }
      }

      testsMeta.push({
        id: test.id,
        name: test.name,
        status,
        report: reportPath,
      });
    }

    meta = {
      browser,
      viewport,
      model: config.model,
      run: stamp,
      date: `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`,
      status: testsMeta.every((t) => t.status === 'PASS') ? 'PASS' : 'FAIL',
      summary: 'Metadati generati dalla CI: report/metadata non generati dall\'agente.',
      tests: testsMeta,
      bugs: { high: 0, medium: 0, low: 0 },
      reportPaths,
      screenshotPaths,
    };
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    console.warn(`[report] Metadata di sessione mancanti: generati fallback in ${metaPath}`);
  }

  // NB: in CI ogni test e' una sessione agent separata che scrive lo STESSO
  // metadata.json di sessione: il file sopravvissuto contiene solo l'ULTIMO
  // test eseguito per questa combo. La lista dei test va quindi SEMPRE
  // ricostruita dai risultati osservati dalla CI, arricchendo con i report
  // dichiarati dall'agente quando disponibili.
  const agentTestsById = new Map((meta.tests ?? []).map((t) => [t.id, t]));
  const testsMeta = results.map(({ test, status }) => {
    const agentTest = agentTestsById.get(test.id);
    const reportPath = agentTest?.report ?? `${sessionDir}/tests/${test.id}.md`;
    return {
      id: test.id,
      name: test.name,
      // Lo status osservato dalla CI (CI_STATUS) ha la priorita' su quello dichiarato dall'agente
      status,
      report: reportPath,
    };
  });

  const reportPaths = testsMeta.map((t) => t.report);

  // Screenshot: unione tra quelli dichiarati nei metadata sopravvissuti e
  // quelli effettivamente presenti su disco (prefissati "<test-id>-").
  const shotsDir = `${sessionDir}/screenshots`;
  const screenshotPaths = Array.isArray(meta.screenshotPaths) ? [...meta.screenshotPaths] : [];
  if (existsSync(shotsDir)) {
    for (const f of readdirSync(shotsDir)) {
      if (results.some(({ test }) => f.startsWith(`${test.id}-`))) {
        const p = `${shotsDir}/${f}`;
        if (!screenshotPaths.includes(p)) screenshotPaths.push(p);
      }
    }
  }
  // Bug counts: fonte primaria = metadata temporanei per-test (un file per test,
  // nessuna sovrascrittura). Fallback: metadata.json di sessione sopravvissuto
  // (run legacy o agente che non ha scritto i file temporanei), altrimenti 0.
  const bugs = { high: 0, medium: 0, low: 0 };
  if (perTestMetas.size > 0) {
    for (const pt of perTestMetas.values()) {
      bugs.high += Number(pt.bugs?.high) || 0;
      bugs.medium += Number(pt.bugs?.medium) || 0;
      bugs.low += Number(pt.bugs?.low) || 0;
    }
  } else {
    bugs.high = Number(meta.bugs?.high) || 0;
    bugs.medium = Number(meta.bugs?.medium) || 0;
    bugs.low = Number(meta.bugs?.low) || 0;
  }

  // Coerenza bug/screenshot: ogni bug dichiarato deve avere almeno uno screenshot
  // (regola del prompt di run). Se non c'e', l'agente non ha documentato i bug: warning.
  if ((bugs.high + bugs.medium + bugs.low) > 0 && screenshotPaths.length === 0) {
    console.warn(
      `[report] ATTENZIONE: ${bugs.high + bugs.medium + bugs.low} bug dichiarati ma nessuno screenshot salvato ` +
      `in ${shotsDir} (l'agente ha violato la regola screenshot-su-bug del prompt di run).`
    );
  }

  const allPass = testsMeta.length > 0 && testsMeta.every((t) => t.status === 'PASS');

  // Summary di sessione (testo leggibile, equivalente del vecchio summary.md)
  // Summary: resoconto della sessione generato con una chiamata LLM dedicata.
  // Fallback 1: concatenazione dei summary AI per-test. Fallback 2: boilerplate.
  const { text: aiSummary, cost: aiSummaryCost } = await generateAiSessionSummary(browser, viewport, config, stamp, testsMeta, perTestMetas, bugs);
  const perTestSummaries = testsMeta
    .map((t) => {
      const s = perTestMetas.get(t.id)?.summary?.trim();
      return s ? `- ${t.name} (${t.status}): ${s}` : null;
    })
    .filter(Boolean);
  const summary = aiSummary
    ?? (perTestSummaries.length ? perTestSummaries.join('\n') : null)
    ?? [
        `Esito complessivo: ${allPass ? 'PASS' : 'FAIL'}`,
        `Browser: ${browser} | Viewport: ${viewport} | Modello AI: ${config.model}`,
        `Data: ${stamp.slice(0, 10)} ${stamp.slice(11).replace(/-/g, ':')}`,
        `Bug: HIGH ${bugs.high} / MEDIUM ${bugs.medium} / LOW ${bugs.low}`,
        '',
        'Test eseguiti:',
        testsMeta.map((t) => `- ${t.name}: ${t.status}`).join('\n'),
      ].join('\n');

  // Data della sessione in UTC ISO (derivata dallo stamp UTC)
  const isoDate = `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`;

  // Costo AI della sessione in USD: somma dei costi per-test registrati nei
  // metadati temporanei (writeTestCost) + costo della chiamata LLM del summary
  // di sessione. Fallback: metadata sopravvissuto.
  const sessionCost = ([...perTestMetas.values()].reduce((acc, pt) => acc + (Number(pt.cost) || 0), 0)
    || Number(meta.cost) || 0) + (Number(aiSummaryCost) || 0);

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
    cost: roundCost(sessionCost),
    reportPaths,
    screenshotPaths,
  };

  writeFileSync(`${sessionDir}/metadata.json`, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[report] Salvato ${sessionDir}/metadata.json`);

  // Cleanup: i metadata temporanei per-test sono stati aggregati, non servono piu'
  if (perTestMetas.size > 0) {
    rmSync(`${sessionDir}/metadata`, { recursive: true, force: true });
    console.log(`[report] Rimossi metadata temporanei per-test (${perTestMetas.size} file)`);
  }
  return metadata;
}

/**
 * Crea/aggiorna reports/index.json con il record della run corrente.
 * Upsert idempotente per `run`: preserva i record delle run precedenti
 * (presenti nel file locale, tipicamente scaricato dallo storico blob
 * da upload-reports-to-azure.mjs nelle run precedenti).
 */
function updateRunsIndex(stamp, config, hasFailures, sessionMetas) {
  const indexPath = `${PATHS.reports}/${RUN_INDEX_FILE}`;
  const entry = buildRunIndexEntry({
    run: stamp,
    date: `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`,
    hasFailures,
    sessions: sessionMetas,
    // Branch sorgente su Azure Pipelines (assente in locale)
    branch: process.env.BUILD_SOURCEBRANCH?.trim() || undefined,
  });

  const existing = parseRunIndex(readRunIndexFile(PATHS.reports));
  const updated = upsertRunIndex(existing, entry);
  writeRunIndexFile(PATHS.reports, updated);
  console.log(`[report] Index run aggiornato: ${indexPath} (${updated.length} run)`);
}

function writeRunMetadata(stamp, config, hasFailures, sessionMetas = []) {
  const runDir = `${PATHS.reports}/${stamp}`;
  mkdirSync(runDir, { recursive: true });

  // Albero delle combinazioni browser → viewport, senza concatenazione "browser/viewport"
  const sessions = config.browsers.map((browser) => ({
    browser,
    viewports: [...config.viewports],
  }));

  // Costo AI totale della run in USD: somma dei costi di sessione
  const totalCost = sessionMetas.reduce((acc, s) => acc + (Number(s?.cost) || 0), 0);

  const data = {
    run: stamp,
    // Data della run in UTC ISO: la dashboard la converte nel fuso locale dell'utente
    date: `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`,
    status: hasFailures ? 'FAIL' : 'PASS',
    sessions,
    // Costo AI totale della run in USD
    cost: roundCost(totalCost),
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

/** Arroonda un costo USD a 6 decimali (precisione sufficiente per i report). */
function roundCost(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) / 1e6 : 0;
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
1. Comportamento generale (obbligatorio):
   - Usa il browser come un utente REALE: testa tutti i flussi di personalizzazione disponibili, verifica la coerenza
     tra cio' che l'utente seleziona e cio' che finisce nel carrello, leggi prezzi e costi DINAMICAMENTE dalla pagina
     (mai valori hardcoded).
   - NON scrivere test Playwright automatizzati, NON usare codegen, NON creare file di test automatizzati,
     NON modificare codice sorgente, NON testare backend/API/logica server-side.
2. Preparazione browser (PRIMA di navigare all'url del test):
   - Avvia il browser in modalita' incognito/profilo isolato per simulare un utente reale senza cookie/cache preesistenti.
   - Ridimensiona il browser al viewport richiesto dalla run con browser_resize PRIMA di navigare
     (es. browser_resize({ width: 1280, height: 650 })) e rispettalo per tutta la run.
   - Attendi che la pagina sia completamente caricata prima di iniziare il test.
   - Chiudi banner e popup: cerca e chiudi eventuali consensi cookie, banner pubblicitari, popup di newsletter o altri
     overlay che ostruiscono la vista (clicca "Accetta", "Rifiuta", "Chiudi", "X" o simili).
   - Overlay di upsell nel carrello: quando si naviga al carrello dopo aver aggiunto un prodotto si apre AUTOMATICAMENTE
     un overlay di upsell. NON e' un errore: comportamento atteso, chiudilo con la "X" in alto a destra prima di
     procedere. NON documentarlo come bug.
3. Gestione viewport durante il test:
   - Prima di ogni interazione o verifica visiva, assicurati che l'elemento/sezione da testare sia COMPLETAMENTE visibile
     nel viewport: se e' parzialmente visibile o fuori vista, scrolla fino a renderlo completamente visibile prima di
     procedere (fondamentale per permettere all'operatore umano di monitorare il test in tempo reale).
4. Vision vs DOM:
   - Usa screenshot (playwright__browser_take_screenshot) per verifiche VISIVE: coerenza di layout/allineamenti/spacing,
     colori/font/dimensioni, hover e focus states, rendering di immagini/anteprime/overlay, elementi sovrapposti o tagliati,
     anteprime sfocate o distorte, testi troncati o formattazione inconsistente.
   - Usa snapshot (playwright__browser_snapshot) per contenuti e funzionalita': leggere prezzi/quantita'/nomi, verificare
     presenza e cliccabilita' di pulsanti/campi/messaggi, compilare form, selezionare opzioni, navigare tra elementi.
   - In dubbio: vision per aspetti UI/UX, DOM per aspetti funzionali/di contenuto.
5. Aspetti UI da verificare indipendentemente dal test (segnala anomalie nel report):
   - Layout e rendering: il componente React si renderizza senza errori visibili; layout coerente con il resto della pagina
     Shopify; nessun elemento sovrapposto o tagliato; immagini anteprima di buona qualita'; pulsanti di personalizzazione
     ben distinguibili (attivo vs non attivo).
   - Feedback visivo: hover state sui pulsanti; focus state visibile per accessibilita' keyboard.
   - Tipografia e colori: font leggibili e coerenti; contrasto sufficiente; colori coerenti col brand; dimensioni testo appropriate.
6. Cosa monitorare (segnala anomalie nel report):
   - Errori tecnici: errori console JavaScript; richieste HTTP 4xx/5xx; React warnings/errors; elementi non cliccabili che
     dovrebbero esserlo; pulsanti senza effetto; pagine bianche o blank states; loop di navigazione o re-rendering infiniti.
   - Problemi UX: prezzi non aggiornati correttamente; anteprime non funzionanti o non aggiornate; form che si resettano
     inaspettatamente; elementi aggiunti al carrello senza selezione utente; messaggi di errore mancanti o poco chiari;
     feedback visivo assente dopo azioni; stato del personalizzatore perso durante la navigazione.
7. Note specifiche:
   - Massima attenzione ai caratteri testuali: errori di battitura, caratteri speciali errati, formattazione inconsistente,
     testo troncato o illeggibile.
   - NON segnalare come bug: il nome del giocatore visualizzato in MAIUSCOLO (comportamento corretto e desiderato); taglie
     che non compaiono affatto (dipendono dalla configurazione del prodotto, alcune possono non esserci); l'overlay di upsell
     nel carrello (comportamento atteso, si chiude con la "X").
   - Documenta ogni anomalia, anche se sembra minore. Presta attenzione a problemi React (state management, re-rendering,
     lifecycle). Verifica che l'anteprima si aggiorni in tempo reale.
   - Traccia il tempo di esecuzione del test e includilo nel report (sezione Execution Time).
   - A fine test: chiudi il browser MCP e cancella il contenuto della cartella .playwright-mcp (se esiste).
     Tutte le operazioni di cleanup e creazione cartelle sono AUTOMATICHE, senza chiedere conferma.
8. Il test di questa run e' UNO SOLO (definizioni in config.ts). NON eseguire altri test.
   - id: ${test.id} | name: ${test.name} | file: ${test.file} | url: ${test.url}${test.notes ? ` | note: ${test.notes} (applica questa nota con priorita')` : ''}
9. Esegui il test: naviga all'url indicato, leggi le istruzioni dal file "tests/${test.file}" con un tool filesystem e applicale.
10. Usa i tool playwright__ per il browser ${browser}: profilo isolato, headless, viewport ${viewport} (rispettalo per tutta la run).
11. L'unico file Markdown di reportistica e' il report del test del punto 13; i metadati JSON del punto 14
   vanno generati direttamente da te (NESSUN parsing del Markdown da parte di script).
   Struttura obbligatoria dei file (usa i tool filesystem per creare file e cartelle):
   ${sessionDir}/
     screenshots/             (screenshot della sessione, prefissati con "${test.id}-", es. screenshots/${test.id}-001.png)
     tests/${test.id}.md      (report Markdown del test, creato solo alla fine, punto 13)
     metadata/${test.id}.json  (metadati JSON TEMPORANEI del test, generati da te, punto 14)
   SCREENSHOT (REGOLA STRETTA): salva screenshot ESCLUSIVAMENTE per documentare bug/anomalie trovate
   (per ogni bug uno o piu' screenshot, quelli necessari a mostrare il problema), prefissati con "${test.id}-". VIETATI screenshot
   "di documentazione", "di stato iniziale" o di pagine che funzionano correttamente. Se il test e' PASS e
   non hai bug da documentare, NON salvare NESSUN screenshot (cartella screenshots/ vuota o non creata).
   Ogni screenshot salvato deve corrispondere a un bug citato nel report.
   COME salvare uno screenshot (procedura obbligatoria quando trovi un bug):
   1. Crea la cartella se non esiste: ${sessionDir}/screenshots/ (tool filesystem o shell).
   2. Chiama playwright__browser_take_screenshot con il parametro "filename" imposto al percorso
      ASSOLUTO del file, es. "${sessionDir}/screenshots/${test.id}-001.png" (senza filename l'immagine
      NON viene salvata su disco e il bug resta senza evidenza).
   3. Verifica con un tool filesystem/shell che il file esista; se non esiste, riprova.
   4. Linkalo inline nel report Markdown: ![descrizione](../screenshots/${test.id}-001.png)
      e aggiungi il percorso in "screenshotPaths" nei metadati.
13. Alla fine crea il report Markdown ${sessionDir}/tests/${test.id}.md (tutti i testi in italiano).
   Sei libero di organizzare il report come preferisci (tabelle, griglie, sezioni, ecc.), ma deve contenere almeno:
   - Executive Summary: stato generale del test
   - Test Scenario: configurazione utilizzata (taglia, personalizzazione, patch, prezzo finale)
   - Bugs Found: lista dettagliata dei bug con severita' (HIGH/MEDIUM/LOW), descrizione, steps to reproduce,
     expected vs actual, impact e screenshot inline nel punto giusto
   - Technical Observations: errori console, network issues, React warnings
   - UX Issues: problemi di usabilita' con suggerimenti
   - Recommendations: suggerimenti per fix prioritizzati
   - Execution Time: tempo totale impiegato per eseguire il test
   - Viewport: dimensioni della finestra del browser (${viewport})
   Regole per il Markdown:
   - Gli screenshot vanno linkati inline con percorso relativo: ![descrizione](../screenshots/${test.id}-001.png)
   - Per ogni bug usa il template con "**Severity:** HIGH/MEDIUM/LOW" (o gli emoji 🔴/🟡/🟢 nel titolo),
     "**Location:**" (dove si verifica: PDP, cart, preview, etc.), "**Description:**", "**Steps to Reproduce:**",
     "**Expected:**", "**Actual:**", "**Impact:**" e "**Screenshot:**" (inline se disponibile).
   - Lo status deve riflettere l'esito REALE della verifica: se la condizione richiesta dal test NON e' soddisfatta, lo status e' FAIL
     (es. se il test chiede di verificare la presenza di una voce nel menu e la voce non c'e', lo status e' FAIL).
   - Questo report e' la fonte visuale per la dashboard dei report: scrivilo con cura, con un layout curato
     (tabelle, titoli, screenshot inline nel punto giusto).
14. Alla fine crea ANCHE i metadati JSON TEMPORANEI ${sessionDir}/metadata/${test.id}.json con ESATTAMENTE questo schema (JSON valido, nessun testo extra):
   {
     "id": "${test.id}",
     "name": "${test.name}",
     "browser": "${browser}",
     "viewport": "${viewport}",
     "model": "${model}",
     "run": "${stamp}",
     "date": "${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z",
     "duration": "es. 3m 12s",
     "status": "PASS" | "FAIL",
     "summary": "resoconto del test in italiano (2-4 frasi): cosa hai verificato, esito, bug trovati con severita' e impatto",
     "report": "${sessionDir}/tests/${test.id}.md",
     "bugs": { "high": 0, "medium": 0, "low": 0 },
     "screenshotPaths": ["${sessionDir}/screenshots/${test.id}-001.png"]
   }
   Regole per i metadati:
   - Il file DEVE essere ${sessionDir}/metadata/${test.id}.json (un file per test, NON metadata.json).
   - "status" deve corrispondere all'esito REALE del test (stesso criterio del punto 13).
   - "bugs" contiene i conteggi REALI dei bug per severita' trovati nel test (0 se nessuno).
   - "screenshotPaths" elenca TUTTI gli screenshot salvati (vuoto se nessuno).
   - Sono metadati temporanei: lo script CI li aggrega nel metadata.json di sessione e poi li cancella.
15. Non chiedere conferma. Non committare. Non modificare i file di test.

CHECK FINALE (obbligatorio prima di rispondere con CI_STATUS):
- Ogni bug nel report ha almeno uno screenshot salvato su disco in ${sessionDir}/screenshots/ e linkato inline nel report?
- "screenshotPaths" in metadata/${test.id}.json elenca TUTTI i file effettivamente presenti in screenshots/?
- Se hai dichiarato bug ma screenshots/ e' vuota, NON procedere: salva gli screenshot mancanti prima di continuare.

Quando hai finito (report .md e metadata/${test.id}.json scritti), l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, se la condizione del test non e' soddisfatta, oppure se il test non e' completabile.
IMPORTANTE: CI_STATUS deve corrispondere ESATTAMENTE allo "status" in metadata/${test.id}.json e nello status nel report Markdown che hai scritto.`;
}

await main();