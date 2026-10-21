import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import 'dotenv/config';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { E2E_TESTS, BROWSERS, VIEWPORTS, AI_MODELS, MAX_PARALLEL_SESSIONS, PATHS, PROJECT_PROMPT } =
  await jiti.import('../configs/index.ts');
// Schema Zod condiviso con l'app Next.js: unica fonte di verità per la
// validazione della run config (incluso lo shortcut "*" = tutti i test).
const { parseRunConfig, RunConfigValidationError } = await jiti.import(
  '../src/lib/run-config-schema.ts',
);

import {
  buildRunIndexEntry,
  parseRunIndex,
  readRunIndexFile,
  RUN_INDEX_FILE,
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
// Schema Zod in src/lib/run-config-schema.ts, validato qui contro il
// catalogo in configs/index.ts.

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
 * Valida la run config grezza con lo schema Zod condiviso
 * (src/lib/run-config-schema.ts, incluso lo shortcut "*" = tutti i test) e
 * risolve i test selezionati contro il catalogo in configs/index.ts, con
 * override delle note. Ritorna la config normalizzata o solleva un errore.
 */
function validateRunConfig(raw) {
  try {
    const config = parseRunConfig(raw, {
      E2E_TESTS,
      BROWSERS,
      VIEWPORTS,
      AI_MODELS,
      MAX_PARALLEL_SESSIONS,
    });

    // Risoluzione dei test selezionati contro il catalogo, con override note
    const testsById = new Map(E2E_TESTS.map((t) => [t.id, t]));
    return {
      tests: config.tests.map(({ id, notes }) => {
        const catalogTest = testsById.get(id);
        const note = notes?.trim();
        return note ? { ...catalogTest, notes: note } : catalogTest;
      }),
      browsers: [...config.browsers],
      viewports: [...config.viewports],
      model: config.aiModel,
      maxParallelSessions: config.maxParallelSessions,
      browserMode: config.browserMode,
    };
  } catch (error) {
    if (error instanceof RunConfigValidationError) throw error;
    throw new Error(`Run config non valida: ${error?.message ?? error}`);
  }
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
    maxRetries:
      Number(process.env.OPENROUTER_MAX_RETRIES) >= 1
        ? Number(process.env.OPENROUTER_MAX_RETRIES)
        : 5,
    retryBaseMs: 2000,
    maxTurns:
      Number(process.env.OPENROUTER_MAX_TURNS) >= 1
        ? Number(process.env.OPENROUTER_MAX_TURNS)
        : 300,
    // Timeout della singola chiamata OpenRouter: senza, una richiesta appesa
    // resta bloccata fino al timeout di default di Node (~5 minuti).
    llmTimeoutMs:
      Number(process.env.OPENROUTER_TIMEOUT_MS) >= 1000
        ? Number(process.env.OPENROUTER_TIMEOUT_MS)
        : 120000,
    mcpToolTimeout: 180000,
    ...runConfig,
  };
}

// ============================================================================
// 1b. MODELLO ERRORI, INTERRUZIONE RUN & LOG DI SESSIONE
// ============================================================================
//
// Ogni test chiude con PASS / FAIL (esito reale dichiarato dall'agente) oppure
// ERROR (test non giunto a esito) con un errorType che ne classifica la causa.

const ERROR_TYPES = {
  llm_quota: {
    label: 'Credito o chiave OpenRouter non validi (HTTP 401/402/403)',
    hint: 'Verificare credito e limiti della chiave OpenRouter, poi rilanciare la run.',
  },
  llm_transient: {
    label: 'Errore temporaneo OpenRouter (rete, 429, 5xx o timeout) persistente dopo i retry',
    hint: 'Rilanciare il test; se ricorrente verificare lo stato di OpenRouter e del provider.',
  },
  llm_bad_response: {
    label: 'Risposte anomale del modello (vuote o finish_reason=error) persistenti dopo i retry',
    hint: 'Rilanciare il test; se ricorrente valutare un altro modello o provider.',
  },
  llm_request: {
    label: 'Richiesta rifiutata da OpenRouter (HTTP 4xx)',
    hint: 'Verificare modello e parametri della richiesta nel log della sessione.',
  },
  no_ci_status: {
    label: "Il modello ha chiuso la sessione senza dichiarare l'esito (CI_STATUS)",
    hint: "Leggere l'ultima risposta del modello e il log della sessione, poi rilanciare il test.",
  },
  turn_budget: {
    label: 'Budget turni esaurito prima della conclusione del test',
    hint: 'Semplificare il test o aumentare OPENROUTER_MAX_TURNS.',
  },
  mcp_init: {
    label: 'Avvio dei server MCP o del browser fallito',
    hint: "Verificare installazione dei browser Playwright e connettivita' dell'agente.",
  },
  mcp_crash: {
    label: 'Server MCP terminato durante la sessione',
    hint: "Verificare memoria e risorse dell'agente Azure, poi rilanciare il test.",
  },
  aborted: {
    label: 'Run interrotta (pipeline cancellata o agente arrestato)',
    hint: "Verificare la run su Azure DevOps e lo stato dell'agente, poi rilanciare.",
  },
  skipped: {
    label: 'Test non avviato: la run era già stata interrotta',
    hint: "Risolvere la causa dell'interruzione indicata nel dettaglio e rilanciare la run.",
  },
  internal: {
    label: 'Errore interno del runner',
    hint: 'Consultare lo stack trace nel log della sessione.',
  },
};

// Solleciti a dichiarare l'esito quando il modello chiude senza CI_STATUS, e
// continuazioni concesse per risposte troncate (finish_reason=length): turni
// extra, non conteggiati nel budget.
const MAX_CI_STATUS_NUDGES = 2;
const MAX_LENGTH_NUDGES = 2;
// Tempo massimo per la finalizzazione dopo SIGTERM/SIGINT prima dell'uscita forzata
const ABORT_GRACE_MS = 25000;

/** Errore di una chiamata OpenRouter, classificato per decidere retry/abort. */
class LlmError extends Error {
  /** @param {'quota'|'transient'|'bad_response'|'request'|'aborted'} kind */
  constructor(kind, message, httpStatus) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

/** Errore che chiude la sessione con un errorType esplicito. */
class SessionError extends Error {
  constructor(errorType, message) {
    super(message);
    this.name = 'SessionError';
    this.errorType = errorType;
  }
}

// Interruzione globale della run: credito LLM esaurito (le sessioni in corso
// chiudono alla chiamata successiva, le nuove non partono) o segnale di
// terminazione (le chiamate in corso vengono annullate via abortController).
const runAbort = { kind: null, reason: null };
const abortController = new AbortController();

function triggerRunAbort(kind, reason) {
  if (runAbort.kind) return;
  runAbort.kind = kind;
  runAbort.reason = reason;
  console.error(`\n[CI ABORT] ${reason}: nessun nuovo test verra' avviato.\n`);
}

function installProcessHandlers() {
  let signals = 0;
  const onSignal = (signal) => {
    signals += 1;
    if (signals > 1) {
      console.error(`[CI] ${signal} ricevuto di nuovo: uscita immediata.`);
      process.exit(130);
    }
    triggerRunAbort(
      'aborted',
      `Run interrotta da ${signal} (pipeline cancellata o agente arrestato)`,
    );
    abortController.abort();
    // Rete di sicurezza: se la finalizzazione non termina in tempo, esci comunque
    setTimeout(() => {
      console.error('[CI] Finalizzazione oltre il tempo limite: uscita forzata.');
      process.exit(130);
    }, ABORT_GRACE_MS).unref();
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  // Una promise orfana (es. errore di trasporto MCP) non deve abbattere
  // l'intera run: la sessione coinvolta viene gestita dal suo flusso.
  process.on('unhandledRejection', (err) => {
    console.error('[CI] Promise rejection non gestita (ignorata):', err);
  });
}

/**
 * Logger di una sessione (un test): prefissa ogni riga della console con
 * [browser/viewport/test] (le sessioni parallele si alternano nel log della
 * pipeline) e scrive il log completo della sessione in
 * reports/<run>/<browser>/<viewport>/logs/<test-id>.log.
 */
function createSessionLogger({ stamp, browser, viewport, testId }) {
  const prefix = `[${browser}/${viewport}/${testId}]`;
  const dir = `${PATHS.reports}/${stamp}/${browser}/${viewport}/logs`;
  const file = `${dir}/${testId}.log`;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // il log su file non deve mai bloccare la sessione
  }

  const append = (level, msg, detail) => {
    const body = detail ? `${msg}\n${indentBlock(detail)}` : msg;
    try {
      appendFileSync(file, `${new Date().toISOString()} ${level.padEnd(5)} ${body}\n`, 'utf8');
    } catch {
      // il log su file non deve mai bloccare la sessione
    }
  };
  const prefixed = (msg) =>
    String(msg)
      .split('\n')
      .map((line) => `${prefix} ${line}`)
      .join('\n');

  return {
    file,
    info(msg, detail) {
      console.log(prefixed(msg));
      append('INFO', msg, detail);
    },
    warn(msg, detail) {
      console.warn(prefixed(msg));
      append('WARN', msg, detail);
    },
    error(msg, detail) {
      console.error(prefixed(msg));
      append('ERROR', msg, detail);
    },
    // Solo console (il contenuto e' gia' registrato su file con debug)
    stdout(msg) {
      console.log(prefixed(msg));
    },
    // Solo su file: dettagli voluminosi (contenuti completi, argomenti dei tool)
    debug(msg, detail) {
      append('DEBUG', msg, detail);
    },
  };
}

function indentBlock(text) {
  return String(text)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function truncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}… [troncato, ${s.length} caratteri]` : s;
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
  installProcessHandlers();

  // Unità di esecuzione: browser x viewport x test
  const units = config.browsers.flatMap((browser) =>
    config.viewports.flatMap((viewport) =>
      config.tests.map((test) => ({ browser, viewport, test })),
    ),
  );

  console.log(`Run config: ${config.configPath}`);
  console.log(`Browsers: ${config.browsers.join(', ')}`);
  console.log(`Viewports: ${config.viewports.join(', ')}`);
  console.log(`Tests: ${config.tests.map((t) => `${t.id} (${t.name})`).join(', ')}`);
  console.log(`Unità Totali: ${units.length}`);
  console.log(`Sessioni in parallelo: ${config.maxParallelSessions}`);
  console.log(`Browser MCP: ${config.browserMode}`);
  console.log(`Cartella run: ${PATHS.reports}/${stamp}\n`);

  const sessionMetas = [];
  const resultsByCombo = new Map();
  // Finestra temporale reale (wall clock) per combo browser/viewport: min start
  // / max end dei suoi test. Serve per la durata di sessione corretta quando
  // piu' test della stessa combo girano in parallelo (la somma delle durate
  // per-test sovrastimerebbe).
  const comboTimes = new Map();
  let cursor = 0;
  // Wall clock dell'intera run: start prima del pool, end dopo Promise.all
  const runStartedAt = Date.now();

  async function worker() {
    while (cursor < units.length) {
      const unit = units[cursor++];
      const comboKey = `${unit.browser}/${unit.viewport}`;

      const startedAt = Date.now();
      let result;
      if (runAbort.kind) {
        // Run interrotta (credito LLM esaurito o segnale): il test non parte
        result = skipUnit(unit, stamp);
      } else {
        console.log(
          `\n========== E2E: ${unit.browser} @ ${unit.viewport} - test: ${unit.test.id} - Model: ${config.model} ==========\n`,
        );
        result = await runSession(unit, config, stamp, config.browserMode === 'headed');
      }
      const { exitCode, status, errorType, reason, statusSource } = result;
      const endedAt = Date.now();

      // Finestra temporale della combo: min start / max end dei suoi test
      const prev = comboTimes.get(comboKey);
      comboTimes.set(comboKey, {
        start: Math.min(prev?.start ?? startedAt, startedAt),
        end: Math.max(prev?.end ?? endedAt, endedAt),
      });

      if (!resultsByCombo.has(comboKey)) {
        resultsByCombo.set(comboKey, []);
      }
      resultsByCombo.get(comboKey).push({
        test: unit.test,
        // Status osservato dalla CI: PASS / FAIL (dichiarato dall'agente) o
        // ERROR (test non giunto a esito, causa in errorType/reason).
        status,
        ...(errorType ? { errorType } : {}),
        ...(reason ? { reason } : {}),
        ...(statusSource ? { statusSource } : {}),
      });

      if (exitCode !== 0) {
        process.exitCode = Math.max(process.exitCode || 0, exitCode);
      }
    }
  }

  const poolSize = Math.min(config.maxParallelSessions, units.length);
  await Promise.all(Array.from({ length: poolSize }, worker));
  const runDurationSeconds = Math.max(0, Math.round((Date.now() - runStartedAt) / 1000));

  // Aggregazione e generazione dei summary finali
  for (const browser of config.browsers) {
    for (const viewport of config.viewports) {
      const comboKey = `${browser}/${viewport}`;
      const results = resultsByCombo.get(comboKey) ?? [];
      const meta = await aggregateSessionReports(
        browser,
        viewport,
        config,
        stamp,
        results,
        comboTimes.get(comboKey),
      );
      if (meta) sessionMetas.push(meta);
    }
  }

  const runStatus = computeOutcomeStatus(sessionMetas.flatMap((s) => s.tests));
  writeRunMetadata(stamp, config, runStatus, sessionMetas, runDurationSeconds);
  updateRunsIndex(stamp, runStatus, sessionMetas, runDurationSeconds);
  cleanupMcpOutput(stamp);

  if (runAbort.kind) {
    console.error(`\n[CI ABORT] Run interrotta: ${runAbort.reason}`);
  }
  if (runStatus !== 'PASS') {
    console.error(
      runStatus === 'ERROR'
        ? '\n[CI ERROR] Uno o più test non sono giunti a esito (vedi errorType/reason nei report).'
        : '\n[CI FAIL] Uno o più test/browser hanno fallito.',
    );
    // Marker file per la pipeline Azure DevOps: il job e2e gira con
    // continueOnError=true (upload report + email devono partire comunque),
    // quindi lo step finale "fail-pipeline" legge questo file per capire se
    // far fallire la build (solo in modalità pull-request).
    const markerPath = `${process.env.AGENT_TEMPDIRECTORY || '/tmp'}/e2e-failed`;
    try {
      writeFileSync(markerPath, 'fail', 'utf8');
      console.log(`[CI] Marker failure scritto su ${markerPath}`);
    } catch (err) {
      console.error(`[CI ERROR] Impossibile scrivere il marker failure: ${err.message}`);
    }
  } else {
    console.log('\n[CI SUCCESS] Tutti i test sono terminati con successo.');
  }
}

// ============================================================================
// 3. ESECUZIONE SESSIONE AGENTE LLM
// ============================================================================

async function runSession({ browser, viewport, test }, config, stamp, headed) {
  const log = createSessionLogger({ stamp, browser, viewport, testId: test.id });
  // Diagnostica della sessione: alimenta il report di fallback quando il test
  // non giunge a esito (ultima risposta, ultime azioni, finish_reason...).
  const diag = {
    turns: 0,
    lastFinishReason: null,
    lastNativeFinishReason: null,
    lastAssistantText: '',
    recentTools: [],
    toolErrors: 0,
    ciStatusNudges: 0,
    lengthNudges: 0,
  };
  let mcp;
  let sessionCost = 0;
  // Durata reale del singolo test (wall clock, Date.now())
  const startedAt = Date.now();
  // Esito osservato dalla CI: default ERROR (sessione non completata).
  let outcome = { status: 'ERROR', errorType: 'internal', reason: 'Sessione non completata' };

  log.info(`Avvio sessione (modello ${config.model}, budget ${config.maxTurns} turni).`);
  try {
    mcp = await initMcpWithRetry(browser, headed, viewport, stamp, test.id, log);
    const messages = [
      { role: 'user', content: buildPrompt(browser, viewport, test, config.model, stamp, headed) },
    ];
    let finalText = '';
    // Anti-loop: traccia l'ultimo messaggio assistant per rilevare ripetizioni
    let lastAssistantKey = '';
    let repeatCount = 0;
    let nudgedRepeat = false;
    // Soglia di turni oltre la quale si nudga l'agente a finalizzare
    const nudgeTurn = Math.max(1, Math.floor(config.maxTurns * 0.8));
    // True se l'agente ha chiuso naturalmente (risposta senza tool call)
    let completedNaturally = false;

    // I solleciti (CI_STATUS mancante, risposta troncata) sono turni extra
    for (let turn = 0; turn < config.maxTurns + diag.ciStatusNudges + diag.lengthNudges; turn++) {
      // Run interrotta (credito esaurito o segnale): chiusura alla prossima chiamata
      if (runAbort.kind) {
        throw new SessionError(runAbort.kind, runAbort.reason);
      }

      // Nudge a soglia: turni in esaurimento, finalizzare subito
      if (turn === nudgeTurn) {
        messages.push({
          role: 'user',
          content:
            'ATTENZIONE: i turni disponibili stanno per esaurirsi. NON eseguire altre verifiche: ' +
            `finalizza ORA il test, scrivi il report ${stamp}/tests/${test.id}.md e i metadata, ` +
            'e rispondi con CI_STATUS=PASS o CI_STATUS=FAIL.',
        });
        log.warn(`Nudge finalizzazione a turno ${turn}/${config.maxTurns}.`);
      }

      const { data: response, cost: callCost } = await chatCompletion(
        messages,
        mcp.tools,
        config,
        log,
      );
      sessionCost += callCost;

      // chatCompletion garantisce una choice con contenuto o tool call
      const choice = response.choices[0];
      const message = choice.message;
      const toolCalls = message.tool_calls ?? [];
      diag.turns = turn + 1;
      diag.lastFinishReason = choice.finish_reason ?? null;
      diag.lastNativeFinishReason = choice.native_finish_reason ?? null;
      log.debug(
        `[llm] turno ${turn + 1} finish_reason=${choice.finish_reason ?? 'n/d'} ` +
          `native=${choice.native_finish_reason ?? 'n/d'} tool_calls=${toolCalls.length} ` +
          `token=${response.usage?.prompt_tokens ?? '?'}/${response.usage?.completion_tokens ?? '?'} ` +
          `costo=${callCost.toFixed(6)}`,
        message.content || undefined,
      );

      messages.push(message);

      if (message.content) {
        log.stdout(`[assistant] ${message.content}`);
        finalText += `\n${message.content}`;
        diag.lastAssistantText = message.content;

        // Rilevamento ripetizioni: stesso contenuto assistant per 3 turni
        const key = message.content.trim();
        if (key && key === lastAssistantKey) {
          repeatCount += 1;
        } else {
          lastAssistantKey = key;
          repeatCount = 0;
        }
        if (repeatCount >= 3 && !nudgedRepeat) {
          nudgedRepeat = true;
          messages.push({
            role: 'user',
            content:
              'Stai ripetendo la stessa azione/risposta senza progresso. NON ripetere: se un bug è già ' +
              'confermato, documentalo e passa avanti; altrimenti finalizza il test, scrivi report e metadata ' +
              'e rispondi con CI_STATUS=PASS o CI_STATUS=FAIL.',
          });
          log.warn(`Nudge anti-ripetizione (contenuto identico x${repeatCount}).`);
        }
      }

      if (!toolCalls.length) {
        if (lastCiStatus(finalText)) {
          completedNaturally = true;
          break;
        }
        // Risposta troncata per lunghezza: chiedi di continuare
        if (choice.finish_reason === 'length' && diag.lengthNudges < MAX_LENGTH_NUDGES) {
          diag.lengthNudges += 1;
          messages.push({
            role: 'user',
            content:
              'La tua risposta è stata troncata per lunghezza. Continua da dove eri rimasto, in modo conciso.',
          });
          log.warn(`Risposta troncata (finish_reason=length): richiesta di continuare.`);
          continue;
        }
        // Chiusura senza esito: sollecita la dichiarazione di CI_STATUS
        if (diag.ciStatusNudges < MAX_CI_STATUS_NUDGES) {
          diag.ciStatusNudges += 1;
          messages.push({
            role: 'user',
            content:
              "Non hai ancora dichiarato l'esito del test. Se il test non è concluso, completalo usando i tool; " +
              `altrimenti verifica che il report ${stamp}/tests/${test.id}.md e i metadata siano scritti e termina ` +
              'la risposta con CI_STATUS=PASS o CI_STATUS=FAIL.',
          });
          log.warn(
            `Risposta senza tool call e senza CI_STATUS (finish_reason=${choice.finish_reason ?? 'n/d'}): ` +
              `sollecito ${diag.ciStatusNudges}/${MAX_CI_STATUS_NUDGES}.`,
          );
          continue;
        }
        completedNaturally = true;
        break;
      }

      for (const call of toolCalls) {
        const toolResult = await executeToolCall(call, mcp, config.mcpToolTimeout, log, diag);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResult,
        });
      }

      // Server MCP terminato: inutile proseguire alla cieca (se la run e' stata
      // interrotta, il server e' caduto per lo stesso segnale: vale l'abort)
      if (mcp.dead && !runAbort.kind) {
        throw new SessionError(
          'mcp_crash',
          `Server MCP "${mcp.dead}" terminato durante la sessione (turno ${turn + 1})`,
        );
      }
    }

    outcome = resolveOutcome({
      finalText,
      completedNaturally,
      diag,
      config,
      stamp,
      browser,
      viewport,
      test,
    });
  } catch (err) {
    outcome = outcomeFromError(err);
    if (err instanceof LlmError && err.kind === 'quota') {
      triggerRunAbort('llm_quota', `Credito o chiave OpenRouter non validi: ${err.message}`);
    }
    log.error(`Errore sessione [${outcome.errorType}]: ${err.message}`, err.stack);
  } finally {
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    log.info(
      `Esito ${outcome.status}${outcome.errorType ? ` [${outcome.errorType}]` : ''}` +
        `${outcome.reason ? `: ${outcome.reason}` : ''} — ${diag.turns} turni, ` +
        `${formatDuration(durationSeconds)}, ${roundCost(sessionCost)} USD.`,
    );
    // Costo AI, durata, esito CI e diagnostica: aggiunti ai metadati TEMPORANEI
    // per-test scritti dall'agente (o creati come fallback minimo se l'agente
    // non li ha mai scritti), così l'aggregazione li raccoglie come gli altri
    // campi.
    writeTestMeta(stamp, browser, viewport, test.id, {
      cost: sessionCost,
      durationSeconds,
      outcome,
      diagnostics: diag,
      logFile: toBlobPath(log.file),
    });
    if (mcp?.clients) {
      mcp.closing = true;
      await closeMcpClients(mcp.clients);
    }
  }

  return { exitCode: outcome.status === 'PASS' ? 0 : 2, ...outcome };
}

/** Ultimo CI_STATUS dichiarato nel testo dell'agente (PASS/FAIL) o null. */
function lastCiStatus(text) {
  const matches = [...String(text).matchAll(/CI_STATUS=(PASS|FAIL)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

/**
 * Esito di una sessione conclusa senza eccezioni: CI_STATUS dichiarato,
 * altrimenti lo status scritto dall'agente nei metadata del test, altrimenti
 * ERROR (budget turni esaurito o chiusura senza CI_STATUS).
 */
function resolveOutcome({
  finalText,
  completedNaturally,
  diag,
  config,
  stamp,
  browser,
  viewport,
  test,
}) {
  const declared = lastCiStatus(finalText);
  if (declared) return { status: declared, statusSource: 'ci' };

  const missing = completedNaturally
    ? `il modello ha chiuso la sessione senza CI_STATUS dopo ${diag.ciStatusNudges} solleciti ` +
      `(ultimo finish_reason: ${diag.lastFinishReason ?? 'n/d'})`
    : `budget di ${config.maxTurns} turni esaurito senza CI_STATUS`;

  const agentStatus = readAgentDeclaredStatus(stamp, browser, viewport, test.id);
  if (agentStatus) {
    return {
      status: agentStatus,
      statusSource: 'agent-metadata',
      reason: `Esito letto dai metadata scritti dall'agente: ${missing}.`,
    };
  }

  return {
    status: 'ERROR',
    errorType: completedNaturally ? 'no_ci_status' : 'turn_budget',
    reason: `${missing.charAt(0).toUpperCase()}${missing.slice(1)}.`,
  };
}

/** Converte un'eccezione della sessione in un esito ERROR classificato. */
function outcomeFromError(err) {
  if (err instanceof SessionError) {
    return { status: 'ERROR', errorType: err.errorType, reason: err.message };
  }
  if (err instanceof LlmError) {
    const errorType = {
      quota: 'llm_quota',
      transient: 'llm_transient',
      bad_response: 'llm_bad_response',
      request: 'llm_request',
      aborted: runAbort.kind ?? 'aborted',
    }[err.kind];
    return { status: 'ERROR', errorType, reason: err.message };
  }
  return { status: 'ERROR', errorType: 'internal', reason: err?.message ?? String(err) };
}

/** Status PASS/FAIL scritto dall'agente in metadata/<test-id>.json, o null. */
function readAgentDeclaredStatus(stamp, browser, viewport, testId) {
  const path = `${PATHS.reports}/${stamp}/${browser}/${viewport}/metadata/${testId}.json`;
  if (!existsSync(path)) return null;
  try {
    const status = JSON.parse(readFileSync(path, 'utf8'))?.status;
    return status === 'PASS' || status === 'FAIL' ? status : null;
  } catch {
    return null;
  }
}

/** Esito di un test non avviato perche' la run era gia' stata interrotta. */
function skipUnit({ browser, viewport, test }, stamp) {
  const outcome = {
    status: 'ERROR',
    errorType: 'skipped',
    reason: `Test non avviato: ${runAbort.reason}`,
  };
  console.warn(`[${browser}/${viewport}/${test.id}] ${outcome.reason}`);
  writeTestMeta(stamp, browser, viewport, test.id, { cost: 0, durationSeconds: 0, outcome });
  return { exitCode: 2, ...outcome };
}

/**
 * Aggiunge costo (USD), durata, esito CI e diagnostica ai metadati
 * temporanei per-test `${sessionDir}/metadata/<test-id>.json` scritti
 * dall'agente. Il file viene poi aggregato nel metadata.json di sessione e
 * cancellato.
 */
function writeTestMeta(
  stamp,
  browser,
  viewport,
  testId,
  { cost, durationSeconds, outcome, diagnostics, logFile },
) {
  const path = `${PATHS.reports}/${stamp}/${browser}/${viewport}/metadata/${testId}.json`;
  let meta = null;
  if (existsSync(path)) {
    try {
      meta = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      console.warn(`[report] JSON non valido in ${path}: ${err.message}. Uso il fallback.`);
      meta = null;
    }
  }
  if (!meta) {
    // Fallback: l'agente non ha scritto i metadata (sessione troncata/errata).
    // Creo un file minimo cosi' costo e durata sono SEMPRE registrati per test.
    meta = {
      id: testId,
      name: testId,
      browser,
      viewport,
      status: outcome.status,
      summary: outcome.reason || "Sessione agente incompleta: metadata non generati dall'agente.",
      bugs: { high: 0, medium: 0, low: 0 },
      screenshotPaths: [],
      // Distingue i metadata generati dalla CI da quelli scritti dall'agente
      generatedBy: 'ci',
    };
    mkdirSync(`${PATHS.reports}/${stamp}/${browser}/${viewport}/metadata`, { recursive: true });
  }
  try {
    meta.cost = roundCost(cost);
    meta.durationSeconds = Math.max(0, Math.round(Number(durationSeconds) || 0));
    meta.ciStatus = outcome.status;
    if (outcome.errorType) meta.errorType = outcome.errorType;
    if (outcome.reason) meta.reason = outcome.reason;
    if (outcome.statusSource) meta.statusSource = outcome.statusSource;
    if (diagnostics) meta.diagnostics = diagnostics;
    if (logFile) meta.log = logFile;
    writeFileSync(path, JSON.stringify(meta, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[report] Impossibile registrare costo/durata in ${path}: ${err.message}`);
  }
}

// ============================================================================
// 4. INTEGRAZIONE MCP (MODEL CONTEXT PROTOCOL)
// ============================================================================

// Emulazione device REALE per tutti gli ambienti: @playwright/mcp supporta il
// flag --device con i descrittori di Playwright (viewport + isMobile + hasTouch
// + user-agent). Il viewport reale e' SEMPRE quello del device emulato.
// - tablet/mobile: device dal catalogo configs/index.ts (campo "device" su
//   VIEWPORTS, es. "iPhone 17 Pro", "iPad (gen 11)").
// - desktop: device derivato dall'engine (proprieta' dell'engine, non config
//   utente).
function deviceForViewport(viewport) {
  return VIEWPORTS.find((v) => v.id === viewport)?.device;
}

const DESKTOP_DEVICE_BY_BROWSER = {
  chromium: 'Desktop Chrome',
  firefox: 'Desktop Firefox',
  webkit: 'Desktop Safari',
};

function deviceForBrowser(browser) {
  return DESKTOP_DEVICE_BY_BROWSER[browser];
}

// Cartella degli output automatici di @playwright/mcp (snapshot, log console):
// una per sessione, cosi' le sessioni parallele non si cancellano i file a
// vicenda. Resta dentro la working directory perche' l'agente li legge con i
// tool filesystem; viene rimossa a fine run (cleanupMcpOutput).
const MCP_OUTPUT_ROOT = '.playwright-mcp';

function mcpOutputDir(stamp, browser, viewport, testId) {
  return `${process.cwd()}/${MCP_OUTPUT_ROOT}/${stamp}/${browser}-${viewport}-${testId}`;
}

function cleanupMcpOutput(stamp) {
  try {
    rmSync(`${MCP_OUTPUT_ROOT}/${stamp}`, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[mcp] Impossibile rimuovere ${MCP_OUTPUT_ROOT}/${stamp}: ${err.message}`);
  }
}

async function initMcpServers(browser, headed, viewport, outputDir, log) {
  const cwd = process.cwd();
  // Priorita' al device del viewport (mobile/tablet); fallback al device del
  // browser (desktop).
  const viewportDevice = deviceForViewport(viewport);
  const device = viewportDevice ?? deviceForBrowser(browser);
  const serverConfigs = [
    {
      name: 'playwright',
      command: 'npx',
      args: [
        '-y',
        '@playwright/mcp',
        // headed e' il default di @playwright/mcp: il flag esiste solo per headless
        ...(headed ? [] : ['--headless']),
        '--isolated',
        '--browser',
        browser,
        // Device emulation REALE per tutti gli ambienti: il viewport reale e'
        // sempre quello del device emulato.
        ...(device ? ['--device', device] : []),
        '--output-dir',
        outputDir,
      ],
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

  // dead: nome del server MCP terminato durante la sessione (null se tutti vivi)
  // closing: true durante la chiusura volontaria (non e' un crash)
  const mcp = { clients: [], tools: [], toolMap: new Map(), dead: null, closing: false };

  try {
    for (const s of serverConfigs) {
      const transport = new StdioClientTransport({
        command: s.command,
        args: s.args,
        cwd,
        env: s.env,
      });
      const client = new Client({ name: 'e2e-ci-agent', version: '1.0.0' });

      log.info(`[mcp] Connessione a ${s.name}...`);
      await client.connect(transport);
      mcp.clients.push(client);
      client.onclose = () => {
        if (mcp.closing || mcp.dead) return;
        mcp.dead = s.name;
        log.error(`[mcp] Server ${s.name} terminato inaspettatamente.`);
      };

      const { tools: mcpTools } = await client.listTools();
      for (const t of mcpTools) {
        const exposedName = `${s.name}__${t.name}`;
        mcp.tools.push({
          type: 'function',
          function: {
            name: exposedName,
            description: `[${s.name}] ${t.description ?? ''}`,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        });
        mcp.toolMap.set(exposedName, { client, mcpName: t.name });
      }

      log.info(`[mcp] ${s.name}: ${mcpTools.length} tool caricati`);
    }
  } catch (err) {
    // Avvio parziale: chiudi i server gia' avviati prima di propagare l'errore
    mcp.closing = true;
    await closeMcpClients(mcp.clients);
    throw err;
  }

  log.info(`[mcp] Totale tool disponibili per ${browser}: ${mcp.tools.length}`);
  return mcp;
}

/** Avvio MCP con un retry (download npx o avvio browser possono fallire). */
async function initMcpWithRetry(browser, headed, viewport, stamp, testId, log) {
  const outputDir = mcpOutputDir(stamp, browser, viewport, testId);
  mkdirSync(outputDir, { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      return await initMcpServers(browser, headed, viewport, outputDir, log);
    } catch (err) {
      // Run interrotta: i server possono cadere per lo stesso segnale
      if (runAbort.kind) throw new SessionError(runAbort.kind, runAbort.reason);
      if (attempt >= 2) {
        throw new SessionError('mcp_init', `Avvio dei server MCP fallito: ${err.message}`);
      }
      log.warn(`[mcp] Avvio fallito (${err.message}): nuovo tentativo tra 3s.`);
      await sleep(3000);
    }
  }
}

async function executeToolCall(call, mcp, timeout, log, diag) {
  const name = call.function.name;
  let args = {};

  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = {};
  }

  log.info(`[tool] ${name} args=${JSON.stringify(args).slice(0, 500)}`);
  log.debug(`[tool] ${name} argomenti completi`, truncate(JSON.stringify(args, null, 2), 5000));
  const startedAt = Date.now();
  let rawResult;
  let error = null;

  try {
    const entry = mcp.toolMap.get(name);
    if (!entry) throw new Error(`Tool sconosciuto: ${name}`);

    const res = await entry.client.callTool({ name: entry.mcpName, arguments: args }, undefined, {
      timeout,
      signal: abortController.signal,
    });

    const parts = Array.isArray(res.content) ? res.content : [];
    rawResult =
      parts
        .map((p) => {
          if (p.type === 'text') return p.text;
          if (p.type === 'image') return '[image content omitted]';
          return `[${p.type}]`;
        })
        .join('\n') || JSON.stringify(res);
    // Errore applicativo del tool (es. file inesistente): risultato con isError
    if (res.isError) error = String(rawResult).slice(0, 300);
  } catch (err) {
    error = err.message;
    rawResult = `TOOL ERROR: ${err.message}`;
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (error) {
    diag.toolErrors += 1;
    log.warn(`[tool] ${name} FALLITO dopo ${duration}s: ${error}`);
  } else {
    log.info(`[tool] ${name} completato in ${duration}s (${String(rawResult).length} chars)`);
  }
  log.debug(`[tool] ${name} risultato`, truncate(rawResult, 2000));
  diag.recentTools = [
    ...diag.recentTools,
    { turn: diag.turns, name, ok: !error, error, duration: `${duration}s` },
  ].slice(-10);

  return String(rawResult).slice(0, 200000);
}

async function closeMcpClients(clients) {
  await Promise.allSettled(clients.map((c) => c.close()));
}

// ============================================================================
// 5. CLIENT OPENROUTER (LLM)
// ============================================================================

/** Classe di errore di una risposta HTTP non-OK di OpenRouter. */
function classifyHttpStatus(status) {
  // 401 chiave non valida, 402 credito insufficiente, 403 limite della chiave
  if (status === 401 || status === 402 || status === 403) return 'quota';
  if (status === 408 || status === 429 || status >= 500) return 'transient';
  return 'request';
}

/**
 * Anomalia di una risposta HTTP 200: OpenRouter puo' restituire 200 con un
 * errore del provider nel body o con finish_reason=error e contenuto vuoto.
 * Ritorna la descrizione dell'anomalia o null se la risposta e' utilizzabile.
 */
function responseAnomaly(data) {
  if (data?.error)
    return `errore del provider nella risposta: ${JSON.stringify(data.error).slice(0, 300)}`;
  const choice = data?.choices?.[0];
  if (!choice?.message) return 'risposta senza choices';
  if (choice.finish_reason === 'error') {
    return `finish_reason=error (native_finish_reason=${choice.native_finish_reason ?? 'n/d'})`;
  }
  if (!choice.message.content?.trim() && !choice.message.tool_calls?.length) {
    return `risposta vuota (finish_reason=${choice.finish_reason ?? 'n/d'})`;
  }
  return null;
}

/**
 * Chiamata chat completions con retry sugli errori transitori e sulle
 * risposte anomale. Ritorna { data, cost } dove cost (USD) somma anche i
 * tentativi scartati. Solleva LlmError classificato.
 */
async function chatCompletion(messages, tools, config, log) {
  // Con tools vuoti (chiamate di puro testo, es. summary di sessione) li omettiamo.
  // usage.include: true -> OpenRouter include usage e costo (usage.cost, USD) nella risposta.
  const body = JSON.stringify({
    model: config.model,
    messages,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
    temperature: 0,
    usage: { include: true },
  });
  const warn = (msg) => (log ? log.warn(msg) : console.warn(msg));

  let cost = 0;
  let lastError;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    if (runAbort.kind === 'aborted') throw new LlmError('aborted', runAbort.reason);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.any([AbortSignal.timeout(config.llmTimeoutMs), abortController.signal]),
      });

      if (res.ok) {
        const data = await res.json();
        const callCost = Number(data.usage?.cost);
        if (Number.isFinite(callCost) && callCost > 0) cost += callCost;
        const anomaly = responseAnomaly(data);
        if (!anomaly) return { data, cost };
        lastError = new LlmError('bad_response', `Risposta anomala da OpenRouter: ${anomaly}`);
      } else {
        const errBody = await res.text();
        const kind = classifyHttpStatus(res.status);
        lastError = new LlmError(
          kind,
          `OpenRouter API error ${res.status}: ${errBody.slice(0, 500)}`,
          res.status,
        );
        if (kind !== 'transient') throw lastError;
      }
    } catch (err) {
      if (err instanceof LlmError) {
        if (err.kind !== 'transient' && err.kind !== 'bad_response') throw err;
        lastError = err;
      } else if (err?.name === 'AbortError') {
        throw new LlmError('aborted', runAbort.reason ?? 'Richiesta annullata');
      } else if (err?.name === 'TimeoutError') {
        lastError = new LlmError('transient', `Timeout OpenRouter dopo ${config.llmTimeoutMs} ms`);
      } else {
        lastError = new LlmError('transient', `Errore di rete OpenRouter: ${err?.message ?? err}`);
      }
    }

    if (attempt < config.maxRetries) {
      warn(
        `[llm] Tentativo ${attempt}/${config.maxRetries} fallito (${lastError.message}), retrying...`,
      );
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

/**
 * Formatta una durata in secondi come "2m 34s" (o "45s" sotto il minuto,
 * "1h 2m 3s" sopra l'ora). Sostituisce il vecchio troncamento ai minuti
 * ("Xm 0s") che perdeva i secondi.
 */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Genera il resoconto della sessione con una chiamata LLM dedicata (nessun tool):
 * sintetizza esito, bug e summary per-test in un testo conciso per la dashboard.
 * Ritorna { text, cost } dove cost (USD) e' il costo della chiamata LLM da
 * sommare al costo di sessione; text e' null in caso di errore/risposta vuota
 * (il chiamante applica il fallback).
 */
async function generateAiSessionSummary(
  browser,
  viewport,
  config,
  stamp,
  testsMeta,
  perTestMetas,
  bugs,
) {
  const testsInput = testsMeta
    .map((t) => {
      const pt = perTestMetas.get(t.id);
      const b = pt?.bugs ?? {};
      const error =
        t.status === 'ERROR' ? `\n  non giunto a esito: ${t.reason ?? 'causa non nota'}` : '';
      return `- ${t.name} (${t.status}) | bug HIGH ${b.high ?? 0} / MEDIUM ${b.medium ?? 0} / LOW ${b.low ?? 0}\n  resoconto test: ${pt?.summary?.trim() || 'non disponibile'}${error}`;
    })
    .join('\n');

  const messages = [
    {
      role: 'user',
      content: `Sei un responsabile QA. Scrivi un resoconto conciso (massimo 5 righe, in italiano) di questa sessione di test E2E per la dashboard dei report.
Dati della sessione:
- Browser: ${browser} | Viewport: ${viewport} | Run: ${stamp} | Modello: ${config.model}
- Bug totali: HIGH ${bugs.high} / MEDIUM ${bugs.medium} / LOW ${bugs.low}
- Test eseguiti:
${testsInput}

Requisiti: evidenzia l'esito complessivo, i problemi piu' gravi trovati (con severita') e un giudizio sintetico sulla qualita' del flusso testato. Solo il resoconto, nessun preambolo ne' elenco strutturale dei test.`,
    },
  ];

  // Run interrotta (credito esaurito o segnale): nessuna chiamata LLM aggiuntiva
  if (runAbort.kind) {
    console.warn(`[report] Summary AI di sessione saltato (run interrotta): uso il fallback.`);
    return { text: null, cost: 0 };
  }

  try {
    const { data, cost } = await chatCompletion(messages, [], config);
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.warn('[report] Summary AI di sessione vuoto: uso il fallback.');
      return { text: null, cost };
    }
    return { text, cost };
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

async function aggregateSessionReports(browser, viewport, config, stamp, results, comboTime) {
  const sessionDir = `${PATHS.reports}/${stamp}/${browser}/${viewport}`;
  mkdirSync(sessionDir, { recursive: true });

  // Metadati TEMPORANEI per-test scritti da ogni sessione agent e completati
  // dalla CI (costo, durata, esito CI, diagnostica): un file per test, nessuna
  // sovrascrittura. Verranno cancellati dopo l'aggregazione.
  const perTestMetas = readPerTestMetas(sessionDir);

  // metadata.json di sessione scritto dall'agente (solo run legacy: il prompt
  // attuale chiede i metadata per-test). Usato come fallback per screenshot,
  // bug e costo.
  const metaPath = `${sessionDir}/metadata.json`;
  let legacyMeta = null;
  if (existsSync(metaPath)) {
    try {
      legacyMeta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (err) {
      console.warn(`[report] JSON non valido in ${metaPath}: ${err.message}`);
    }
  }

  // Report Markdown: fallback diagnostico se l'agente non l'ha scritto, avviso
  // in testa se l'esito CI diverge da quello del report dell'agente.
  for (const result of results) {
    ensureTestReport({
      sessionDir,
      browser,
      viewport,
      config,
      stamp,
      result,
      testMeta: perTestMetas.get(result.test.id),
    });
  }

  // Durata della sessione: finestra temporale reale della combo (min start /
  // max end dei suoi test, tracciata nel worker pool).
  const sessionDuration = formatDuration(
    comboTime ? Math.max(0, Math.round((comboTime.end - comboTime.start) / 1000)) : 0,
  );

  const testsMeta = results.map(({ test, status, errorType, reason, statusSource }) => {
    // Durata del singolo test: dai metadati temporanei per-test
    // (durationSeconds scritti da writeTestMeta), formattata. Fallback: ''.
    const pt = perTestMetas.get(test.id);
    const testDuration = Number(pt?.durationSeconds);
    return {
      id: test.id,
      name: test.name,
      // Lo status osservato dalla CI (CI_STATUS) ha la priorita' su quello dichiarato dall'agente
      status,
      ...(errorType ? { errorType } : {}),
      ...(reason ? { reason } : {}),
      ...(statusSource && statusSource !== 'ci' ? { statusSource } : {}),
      ...(Number.isFinite(testDuration) && testDuration > 0
        ? { duration: formatDuration(testDuration) }
        : {}),
    };
  });

  // Screenshot: unione tra quelli dichiarati nei metadata legacy e
  // quelli effettivamente presenti su disco (prefissati "<test-id>-").
  const shotsDir = `${sessionDir}/screenshots`;
  const screenshotPaths = Array.isArray(legacyMeta?.screenshotPaths)
    ? legacyMeta.screenshotPaths.map(toBlobPath)
    : [];
  if (existsSync(shotsDir)) {
    for (const f of readdirSync(shotsDir)) {
      if (results.some(({ test }) => f.startsWith(`${test.id}-`))) {
        const p = toBlobPath(`${shotsDir}/${f}`);
        if (!screenshotPaths.includes(p)) screenshotPaths.push(p);
      }
    }
  }
  // Bug counts: fonte primaria = metadata temporanei per-test (un file per test,
  // nessuna sovrascrittura). Fallback: metadata.json di sessione legacy, altrimenti 0.
  const bugs = { high: 0, medium: 0, low: 0 };
  if (perTestMetas.size > 0) {
    for (const pt of perTestMetas.values()) {
      bugs.high += Number(pt.bugs?.high) || 0;
      bugs.medium += Number(pt.bugs?.medium) || 0;
      bugs.low += Number(pt.bugs?.low) || 0;
    }
  } else {
    bugs.high = Number(legacyMeta?.bugs?.high) || 0;
    bugs.medium = Number(legacyMeta?.bugs?.medium) || 0;
    bugs.low = Number(legacyMeta?.bugs?.low) || 0;
  }

  // Coerenza bug/screenshot: ogni bug dichiarato deve avere almeno uno screenshot
  // (regola del prompt di run). Se non c'e', l'agente non ha documentato i bug: warning.
  if (bugs.high + bugs.medium + bugs.low > 0 && screenshotPaths.length === 0) {
    console.warn(
      `[report] ATTENZIONE: ${bugs.high + bugs.medium + bugs.low} bug dichiarati ma nessuno screenshot salvato ` +
        `in ${shotsDir} (l'agente ha violato la regola screenshot-su-bug del prompt di run).`,
    );
  }

  const status = computeOutcomeStatus(testsMeta);

  // Summary di sessione (testo leggibile, equivalente del vecchio summary.md)
  // Summary: resoconto della sessione generato con una chiamata LLM dedicata.
  // Fallback 1: concatenazione dei summary AI per-test. Fallback 2: boilerplate.
  const { text: aiSummary, cost: aiSummaryCost } = await generateAiSessionSummary(
    browser,
    viewport,
    config,
    stamp,
    testsMeta,
    perTestMetas,
    bugs,
  );
  const perTestSummaries = testsMeta
    .map((t) => {
      const s = (t.status === 'ERROR' ? t.reason : perTestMetas.get(t.id)?.summary)?.trim();
      return s ? `- ${t.name} (${t.status}): ${s}` : null;
    })
    .filter(Boolean);
  const summary =
    aiSummary ??
    (perTestSummaries.length ? perTestSummaries.join('\n') : null) ??
    [
      `Esito complessivo: ${status}`,
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
  // metadati temporanei (writeTestMeta) + costo della chiamata LLM del summary
  // di sessione. Fallback: metadata legacy.
  const sessionCost =
    ([...perTestMetas.values()].reduce((acc, pt) => acc + (Number(pt.cost) || 0), 0) ||
      Number(legacyMeta?.cost) ||
      0) + (Number(aiSummaryCost) || 0);

  const metadata = {
    browser,
    viewport,
    model: config.model,
    run: stamp,
    date: isoDate,
    duration: sessionDuration,
    status,
    summary,
    tests: testsMeta,
    bugs,
    cost: roundCost(sessionCost),
    screenshotPaths,
  };

  writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[report] Salvato ${metaPath}`);

  // Cleanup: i metadata temporanei per-test sono stati aggregati, non servono piu'
  if (perTestMetas.size > 0) {
    rmSync(`${sessionDir}/metadata`, { recursive: true, force: true });
    console.log(`[report] Rimossi metadata temporanei per-test (${perTestMetas.size} file)`);
  }
  return metadata;
}

/**
 * Esito aggregato di un insieme di test (sessione o run): ERROR se almeno un
 * test non e' giunto a esito o la run e' stata interrotta, PASS se tutti
 * passano, altrimenti FAIL.
 */
function computeOutcomeStatus(tests) {
  if (runAbort.kind || tests.some((t) => t.status === 'ERROR')) return 'ERROR';
  if (tests.length > 0 && tests.every((t) => t.status === 'PASS')) return 'PASS';
  return 'FAIL';
}

// Marcatore dell'avviso CI in testa al report dell'agente (evita duplicati)
const CI_BANNER_MARK = '<!-- ci-status-banner -->';

/**
 * Garantisce che ogni test abbia il suo report Markdown:
 * - report assente -> report di fallback con motivo e diagnostica;
 * - report dell'agente con esito diverso da quello CI -> avviso in testa.
 */
function ensureTestReport({ sessionDir, browser, viewport, config, stamp, result, testMeta }) {
  const reportPath = `${sessionDir}/tests/${result.test.id}.md`;

  if (!existsSync(reportPath)) {
    mkdirSync(`${sessionDir}/tests`, { recursive: true });
    writeFileSync(
      reportPath,
      buildFallbackReport({ browser, viewport, config, stamp, result, testMeta, sessionDir }),
      'utf8',
    );
    console.warn(
      `[report] Report mancante per ${result.test.id}: generato fallback in ${reportPath}`,
    );
    return;
  }

  // Status dichiarato dall'agente nei suoi metadata (non quelli generati dalla CI)
  const agentStatus = testMeta && testMeta.generatedBy !== 'ci' ? testMeta.status : null;
  const diverges =
    result.status === 'ERROR' ||
    result.statusSource === 'agent-metadata' ||
    (agentStatus && agentStatus !== result.status);
  if (!diverges) return;

  const current = readFileSync(reportPath, 'utf8');
  if (current.startsWith(CI_BANNER_MARK)) return;
  writeFileSync(reportPath, `${buildCiStatusBanner(result, agentStatus)}\n\n${current}`, 'utf8');
  console.warn(
    `[report] Esito CI divergente per ${result.test.id}: avviso aggiunto in ${reportPath}`,
  );
}

function buildCiStatusBanner(result, agentStatus) {
  const agentLine = agentStatus
    ? `Il report che segue è stato scritto dall'agente e indica **${agentStatus}**.`
    : "Il report che segue è stato scritto dall'agente.";
  if (result.status === 'ERROR') {
    const info = ERROR_TYPES[result.errorType] ?? ERROR_TYPES.internal;
    return [
      CI_BANNER_MARK,
      `> ⚠️ **Esito CI: ERROR** (\`${result.errorType}\`) — ${info.label}.`,
      `> ${result.reason ?? ''}`,
      `> ${agentLine} Va considerato non conclusivo.`,
    ].join('\n');
  }
  return [
    CI_BANNER_MARK,
    `> ℹ️ **Esito CI: ${result.status}**${result.statusSource === 'agent-metadata' ? ", letto dai metadata dell'agente" : ''}.`,
    `> ${result.reason ?? ''}`,
    `> ${agentLine}`,
  ].join('\n');
}

/** Cella di tabella Markdown sicura (niente pipe ne' a capo). */
function mdCell(value) {
  return String(value ?? '—')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
}

/**
 * Report Markdown generato dalla CI quando l'agente non ha scritto il suo:
 * esito, motivo classificato con indicazione su cosa fare, ultima risposta del
 * modello, ultime azioni e artefatti parziali.
 */
function buildFallbackReport({ browser, viewport, config, stamp, result, testMeta, sessionDir }) {
  const { test, status } = result;
  const d = testMeta?.diagnostics;
  const device = deviceForViewport(viewport) ?? deviceForBrowser(browser);
  const statusLabel =
    status === 'ERROR'
      ? '⚠️ ERROR — test non giunto a esito'
      : status === 'PASS'
        ? '✅ PASS'
        : '❌ FAIL';

  const rows = [
    ['Test', `\`${test.id}\` (${test.file})`],
    ['Ambiente', `${browser} · ${viewport}${device ? ` (${device})` : ''}`],
    ['Modello AI', config.model],
    ['Run', stamp],
    ['Esito', statusLabel],
    ['Durata', formatDuration(testMeta?.durationSeconds)],
    ['Turni LLM', d ? `${d.turns}/${config.maxTurns}` : 'non avviato'],
    ['Costo AI', `$${(Number(testMeta?.cost) || 0).toFixed(4)}`],
  ];

  const lines = [
    `# ${test.name} — ${status}`,
    '',
    '| Campo | Valore |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| ${k} | ${mdCell(v)} |`),
    '',
  ];

  if (status === 'ERROR') {
    const info = ERROR_TYPES[result.errorType] ?? ERROR_TYPES.internal;
    lines.push(
      '## Motivo',
      '',
      `**Tipo:** \`${result.errorType}\` — ${info.label}.`,
      '',
      `**Dettaglio:** ${result.reason ?? 'non disponibile'}`,
      '',
      `**Cosa fare:** ${info.hint}`,
      '',
    );
  } else {
    lines.push(
      '## Nota',
      '',
      `Esito ${status} dichiarato dall'agente, ma il report Markdown non è stato generato.` +
        (result.reason ? ` ${result.reason}` : ''),
      '',
    );
  }

  if (d?.lastAssistantText) {
    lines.push(
      '## Ultima risposta del modello',
      '',
      ...truncate(d.lastAssistantText.trim(), 1500)
        .split('\n')
        .map((l) => `> ${l}`),
      '',
    );
  }

  if (d?.recentTools?.length) {
    lines.push(
      `## Ultime azioni (${Math.min(5, d.recentTools.length)})`,
      '',
      '| Turno | Tool | Esito | Durata |',
      '| --- | --- | --- | --- |',
      ...d.recentTools
        .slice(-5)
        .map(
          (t) =>
            `| ${t.turn} | \`${t.name}\` | ${mdCell(t.ok ? 'ok' : `errore: ${truncate(t.error, 160)}`)} | ${t.duration} |`,
        ),
      '',
    );
  }

  if (d) {
    lines.push(
      '## Diagnostica',
      '',
      `- Ultimo finish_reason: \`${d.lastFinishReason ?? 'n/d'}\` (native: \`${d.lastNativeFinishReason ?? 'n/d'}\`)`,
      `- Solleciti CI_STATUS: ${d.ciStatusNudges}/${MAX_CI_STATUS_NUDGES} · continuazioni per risposta troncata: ${d.lengthNudges}/${MAX_LENGTH_NUDGES}`,
      `- Errori dei tool: ${d.toolErrors}`,
      '',
    );
  }

  const shots = existsSync(`${sessionDir}/screenshots`)
    ? readdirSync(`${sessionDir}/screenshots`).filter((f) => f.startsWith(`${test.id}-`))
    : [];
  lines.push(
    '## Artefatti',
    '',
    `- Metadata scritti dall'agente: ${testMeta && testMeta.generatedBy !== 'ci' ? 'sì' : 'no'}`,
    `- Screenshot: ${shots.length ? shots.map((s) => `\`${s}\``).join(', ') : 'nessuno'}`,
    ...(testMeta?.log ? [`- Log completo della sessione: \`${testMeta.log}\``] : []),
    '',
  );

  return lines.join('\n');
}

/**
 * Crea/aggiorna reports/index.json con il record della run corrente.
 * Upsert idempotente per `run`: preserva i record delle run precedenti
 * (presenti nel file locale, tipicamente scaricato dallo storico blob
 * da upload-reports-to-azure.mjs nelle run precedenti).
 */
function updateRunsIndex(stamp, status, sessionMetas, runDurationSeconds) {
  const indexPath = `${PATHS.reports}/${RUN_INDEX_FILE}`;
  const entry = buildRunIndexEntry({
    run: stamp,
    date: `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`,
    status,
    sessions: sessionMetas,
    // Durata wall-clock dell'intera run (misurata nel main)
    duration: formatDuration(runDurationSeconds),
    // Branch sorgente su Azure Pipelines (assente in locale)
    branch: process.env.BUILD_SOURCEBRANCH?.trim() || undefined,
  });

  const existing = parseRunIndex(readRunIndexFile(PATHS.reports));
  const updated = upsertRunIndex(existing, entry);
  writeRunIndexFile(PATHS.reports, updated);
  console.log(`[report] Index run aggiornato: ${indexPath} (${updated.length} run)`);
}

function writeRunMetadata(stamp, config, status, sessionMetas = [], runDurationSeconds = 0) {
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
    status,
    // Motivo dell'interruzione (credito LLM esaurito o segnale), se la run e' stata interrotta
    ...(runAbort.kind ? { abort: { kind: runAbort.kind, reason: runAbort.reason } } : {}),
    sessions,
    // Durata wall-clock dell'intera run (es. "2m 34s")
    duration: formatDuration(runDurationSeconds),
    // Costo AI totale della run in USD
    cost: roundCost(totalCost),
  };

  writeFileSync(`${runDir}/metadata.json`, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[report] Salvato ${runDir}/metadata.json`);
}

// ============================================================================
// 7. UTILITIES & PROMPT BUILDER
// ============================================================================

/**
 * Converte un path locale (relativo alla root del repo, es. "reports/<stamp>/...")
 * nel path relativo alla radice del container blob (es. "<stamp>/..."), che e'
 * il formato usato nei metadata salvati su Azure.
 */
function toBlobPath(p) {
  return p.replace(new RegExp(`^${PATHS.reports}/`), '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Arroonda un costo USD a 6 decimali (precisione sufficiente per i report). */
function roundCost(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) / 1e6 : 0;
}

/**
 * Prompt dell'agente: testo generico condiviso da tutti i progetti, hardcoded
 * qui (la struttura di report/metadati NON deve cambiare). Le istruzioni
 * specifiche del progetto arrivano da PROJECT_PROMPT in configs/index.ts e
 * vengono iniettate tra le regole generali (punto 7) e la definizione del test
 * (punto 8).
 */
function buildPrompt(browser, viewport, test, model, stamp, headed) {
  const sessionDir = `${PATHS.reports}/${stamp}/${browser}/${viewport}`;
  const projectPrompt = PROJECT_PROMPT?.trim() ? `${PROJECT_PROMPT.trim()}\n` : '';

  return `Sei un agente di test E2E in CI Azure, senza operatore umano. Esegui UN SOLO test E2E di questo repository
comportandoti come un utente reale, metodico e rigoroso. Il sito puo' essere di qualunque tipo (e-commerce, editoriale,
servizi, app web): applica le regole generali qui sotto a qualunque contesto, e le istruzioni specifiche del progetto
(se presenti) hanno priorita' su eventuali ambiguita'.

Browser obbligatorio per questa run: ${browser}
Ambiente obbligatorio per questa run: ${viewport} (il browser e' gia' avviato con device emulation Playwright "${deviceForViewport(viewport) ?? deviceForBrowser(browser)}"${deviceForViewport(viewport) ? " — MODALITA' MOBILE/TABLET: isMobile, hasTouch e user-agent mobile sono ATTIVI. Interagisci come su un device reale: tap invece di hover, niente hover state, layout e navigazione mobile" : ''}. NON usare browser_resize e NON cambiare le dimensioni: il viewport del device e' quello corretto e va rispettato per tutto il test)

Hai accesso a questi gruppi di tool MCP (prefisso nel nome del tool):
- filesystem__: leggi/scrivi file del repository (working directory: ${process.cwd()})
- shell__: esegui comandi nel terminale (es. shell__start_terminal_process, shell__interact_with_process)
- playwright__: automazione browser ${browser} (snapshot, click, type, screenshot, ecc.)

REGOLE DI ESECUZIONE:
1. Comportamento generale (obbligatorio):
   - Usa il browser come un utente REALE: naviga, clicca, compila, confronta. Verifica la coerenza tra cio' che
     l'utente seleziona/immette e il risultato (carrello, conferme, riepiloghi, email di conferma visibili a schermo).
     Leggi prezzi, quantita', date e valori DINAMICAMENTE dalla pagina (mai valori hardcoded).
   - NON scrivere test Playwright automatizzati, NON usare codegen, NON creare file di test automatizzati,
     NON modificare codice sorgente, NON testare backend/API/logica server-side.
2. Preparazione browser (PRIMA di navigare all'url del test):
   - Avvia il browser in modalita' incognito/profilo isolato per simulare un utente reale senza cookie/cache preesistenti.
   - Il browser e' gia' avviato con device emulation Playwright "${deviceForViewport(viewport) ?? deviceForBrowser(browser)}"${deviceForViewport(viewport) ? ' (isMobile, hasTouch, user-agent mobile, viewport del device)' : ' (user-agent desktop, viewport del device)'}. NON usare browser_resize e NON modificare le dimensioni: il viewport e' gia' quello corretto.
   - Attendi che la pagina sia completamente caricata prima di iniziare il test (contenuto principale visibile,
     spinner/loader concluse).
   - Chiudi banner e popup: cerca e chiudi eventuali consensi cookie, banner pubblicitari, popup di newsletter o altri
     overlay che ostruiscono la vista (clicca "Accetta", "Rifiuta", "Chiudi", "X" o simili).
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
5. Gestione di elementi web comuni (qualunque sito):
   - Menu e navigazione: voci mancanti, ordine errato, link rotti (404), breadcrumb incoerenti.
   - Form: validazione campi (obbligatori, formati email/telefono, limiti), messaggi di errore chiari, stato dopo submit
     (successo/errore), campi che perdono il valore dopo errori di validazione.
   - Dropdown/select, date picker, slider, toggle, checkbox: verifica che si aprano, che la selezione si applichi e
     che il valore selezionato si rifletta dove previsto (riepiloghi, carrello, preview).
   - Modali e drawer: apertura/chiusura (X, ESC, click fuori), contenuto corretto, focus gestito.
   - Iframe e contenuti embed: se un contenuto non e' interagibile via snapshot, verifica se e' dentro un iframe.
   - Immagini e media: caricamento (no immagini rotte/placeholder), lazy loading che funziona allo scroll, alt text.
   - Scroll infinito/caroselli/paginazione: caricamento di nuovi elementi, controlli di navigazione funzionanti.
   - Autenticazione/aree riservate: se il test la richiede usa le credenziali fornite dal test; se compaiono CAPTCHA o
     blocchi anti-bot NON tentare di aggirarli: documenta il blocco nel report e valuta l'impatto sul test.
   - Lingua/valuta/locale: verifica che i formati (prezzi, date, numeri) siano coerenti con la lingua della pagina.
   - Prestazioni percepibili: tempi di caricamento anomali, layout che "salta" durante il caricamento (CLS visibile),
     interazioni con ritardo evidente: segnala nel report.
6. Affidabilita' (evita falsi positivi/negativi):
   - Attendi il completamento di caricamenti/navigazioni prima di valutare un esito; non giudicare uno stato
     intermedio come bug.
   - Se un'interazione non ha effetto, riprova una volta (possibile race); se fallisce ancora, e' un bug.
   - Distingui ANOMALIA (bug) da COMPORTAMENTO ATTESO documentato nelle istruzioni del progetto o del test.
   - Non inventare contenuti: ogni affermazione nel report deve derivare da cio' che hai visto (snapshot/screenshot).
7. Cosa monitorare sempre (segnala anomalie nel report):
   - Errori tecnici: errori console JavaScript; richieste HTTP 4xx/5xx; React warnings/errors; elementi non cliccabili che
     dovrebbero esserlo; pulsanti senza effetto; pagine bianche o blank states; loop di navigazione o re-rendering infiniti.
   - Problemi UX: valori non aggiornati correttamente; form che si resettano inaspettatamente; elementi aggiunti senza
     azione utente; messaggi di errore mancanti o poco chiari; feedback visivo assente dopo azioni; stato dell'utente
     perso durante la navigazione.
   - Aspetti UI: layout coerente con il resto del sito; nessun elemento sovrapposto o tagliato; immagini di buona
     qualita'; pulsanti e controlli ben distinguibili (attivo vs non attivo); hover state; focus state visibile per
     accessibilita' keyboard; font leggibili e coerenti; contrasto sufficiente; dimensioni testo appropriate.
   - Caratteri testuali: errori di battitura, caratteri speciali errati, formattazione inconsistente, testo troncato o
     illeggibile.
8. Note specifiche:
   - Documenta ogni anomalia, anche se sembra minore. Presta attenzione a problemi React (state management,
     re-rendering, lifecycle) e ad aggiornamenti dinamici in tempo reale (anteprime, totali, contatori).
   - Traccia il tempo di esecuzione del test e includilo nel report (sezione Execution Time).
   - A fine test: chiudi il browser MCP. NON cancellare la cartella .playwright-mcp ne' altri file o cartelle
     fuori da ${sessionDir}/: altre sessioni di test sono in esecuzione in parallelo nella stessa working
     directory e la pulizia e' gestita dalla CI a fine run.
   - NON eseguire ricerche o comandi sul filesystem di sistema (es. find /, du /): lavora solo nella working directory.
   - La creazione delle cartelle del report e' AUTOMATICA, senza chiedere conferma.
${projectPrompt}
9. Il test di questa run e' UNO SOLO (definizioni in configs/index.ts). NON eseguire altri test.
   - id: ${test.id} | name: ${test.name} | file: ${test.file} | url: ${test.url}${test.notes ? ` | note: ${test.notes} (applica questa nota con priorita')` : ''}
10. Esegui il test: naviga all'url indicato, leggi le istruzioni dal file "tests/${test.file}" con un tool filesystem e applicale.
11. Usa i tool playwright__ per il browser ${browser}: profilo isolato, ${headed ? "browser VISIBILE (headed): non chiudere la finestra, l'operatore umano sta guardando" : 'headless'}, ambiente ${viewport} (rispettalo per tutta la run), device emulation Playwright "${deviceForViewport(viewport) ?? deviceForBrowser(browser)}" ATTIVA: NON ridimensionare il viewport.
12. L'unico file Markdown di reportistica e' il report del test del punto 13; i metadati JSON del punto 14
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
   MASSIMO 2 TENTATIVI di screenshot per bug: se lo stato transitorio da catturare non si riproduce dopo
   2 tentativi, documenta il bug nel report senza screenshot e passa oltre (NON riprovare all'infinito).
   Se un bug e' stato confermato 2 volte, consideralo confermato: documentalo nel report e passa alla
   verifica successiva (NON ripetere la stessa riproduzione piu' volte).
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
   - Test Scenario: configurazione utilizzata (dati/opzioni selezionate, valori chiave osservati)
   - Bugs Found: lista dettagliata dei bug con severita' (HIGH/MEDIUM/LOW), descrizione, steps to reproduce,
     expected vs actual, impact e screenshot inline nel punto giusto
   - Technical Observations: errori console, network issues, React warnings
   - UX Issues: problemi di usabilita' con suggerimenti
   - Recommendations: suggerimenti per fix prioritizzati
   - Execution Time: tempo totale impiegato per eseguire il test
   - Viewport: ambiente di esecuzione (${viewport}, device emulato: ${deviceForViewport(viewport) ?? deviceForBrowser(browser)})
   Regole per il Markdown:
   - Gli screenshot vanno linkati inline con percorso relativo: ![descrizione](../screenshots/${test.id}-001.png)
   - Per ogni bug usa il template con "**Severity:** HIGH/MEDIUM/LOW" (o gli emoji 🔴/🟡/🟢 nel titolo),
     "**Location:**" (dove si verifica), "**Description:**", "**Steps to Reproduce:**",
     "**Expected:**", "**Actual:**", "**Impact:**" e "**Screenshot:**" (inline se disponibile).
   - Calibrazione severita': HIGH = blocca il flusso/perdita di dati/prezzo errato/contenuto illeggibile;
     MEDIUM = funzionalita' degradata ma aggirabile o anomalia visibile evidente; LOW = difetto estetico/minore.
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

GESTIONE BUDGET (obbligatoria): hai un numero LIMITATO di turni. Gestisci il tempo con criterio:
- Non ripetere verifiche gia' completate o screenshot gia' tentati.
- Se ricevi un messaggio che ti chiede di finalizzare, obbedisci IMMEDIATAMENTE: scrivi report e metadata
  con i dati gia' raccolti e rispondi con CI_STATUS.
- Se il test non puo' essere completato per tempo, documenta cio' che hai verificato e rispondi comunque
  con CI_STATUS=FAIL (mai terminare senza CI_STATUS: una sessione senza CI_STATUS viene marcata ERROR).

Quando hai finito (report .md e metadata/${test.id}.json scritti), l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, se la condizione del test non e' soddisfatta, oppure se il test non e' completabile.
IMPORTANTE: CI_STATUS deve corrispondere ESATTAMENTE allo "status" in metadata/${test.id}.json e nello status nel report Markdown che hai scritto.`;
}

await main();
