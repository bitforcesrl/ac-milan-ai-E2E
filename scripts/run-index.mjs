import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// INDEX RUNS (reports/index.json)
// ============================================================================
// Unico punto di logica per la generazione/aggiornamento di reports/index.json,
// il file che alimenta la tabella della dashboard Next.js (/reports).
//
// Schema di ogni record (allineato a RunSummary in lib/azure-reports.ts e al
// tipo RunIndexEntry in lib/run-index.ts):
//
//   {
//     "run": "2026-09-28_10-07-34",              // id run (= nome cartella report)
//     "date": "2026-09-28T10:07:34Z",            // data/ora UTC ISO
//     "status": "PASS" | "FAIL",
//     "pass": 3, "fail": 1, "total": 4,
//     "passRate": 75,                            // percentuale arrotondata
//     "bugs": { "high": 0, "medium": 1, "low": 0 },
//     "duration": "12m 0s",
//     "environments": [{ "browser": "chromium", "viewport": "1280x650" }],
//     "branch": "refs/heads/main"                // opzionale, solo su Azure
//   }
//
// Il file è un array di questi oggetti, ordinato dal più recente al più vecchio.
// La scrittura è IDEMPOTENTE: upsert per `run`, senza duplicati, preservando
// i record delle run precedenti.
// ============================================================================

export const RUN_INDEX_FILE = 'index.json';

/** Normalizza un conteggio a intero >= 0. */
function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Costruisce il record di index.json per una run a partire dai metadata di
 * sessione prodotti da run-e2e-ci.mjs (aggregateSessionReports).
 *
 * @param {object} input
 * @param {string} input.run            Stamp della run (es. "2026-09-28_10-07-34")
 * @param {string} input.date           Data UTC ISO della run
 * @param {boolean} input.hasFailures   true se almeno un test è fallito
 * @param {Array<object>} input.sessions  Metadata di sessione (browser, viewport, tests, bugs, duration)
 * @param {string} [input.branch]       Branch sorgente (solo su Azure Pipelines)
 * @returns {object} Record RunIndexEntry
 */
export function buildRunIndexEntry({ run, date, hasFailures, sessions, cost, branch }) {
  const tests = (sessions ?? []).flatMap((s) => s?.tests ?? []);
  const pass = count(tests.filter((t) => t?.status === 'PASS').length);
  const fail = count(tests.filter((t) => t?.status === 'FAIL').length);
  const total = pass + fail;

  const bugs = { high: 0, medium: 0, low: 0 };
  for (const s of sessions ?? []) {
    bugs.high += count(s?.bugs?.high);
    bugs.medium += count(s?.bugs?.medium);
    bugs.low += count(s?.bugs?.low);
  }

  const environments = (sessions ?? [])
    .filter((s) => s?.browser)
    .map((s) => ({ browser: s.browser, viewport: s.viewport ?? '' }));

  const duration = (sessions ?? []).find((s) => s?.duration)?.duration ?? '';

  // Costo AI totale della run in USD: somma dei costi di sessione
  // (parametro `cost` se fornito, altrimenti somma dai metadata di sessione)
  const sessionCost = (sessions ?? []).reduce((acc, s) => acc + (Number(s?.cost) || 0), 0);
  const totalCost = Number(cost) || sessionCost;

  return {
    run,
    date,
    status: hasFailures ? 'FAIL' : 'PASS',
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    bugs,
    duration,
    cost: Math.round(totalCost * 1e6) / 1e6,
    environments,
    ...(branch ? { branch } : {}),
  };
}

/**
 * Converte il testo di index.json in un array di record validi.
 * Ritorna [] se il testo è vuoto/malformato/non-array (comportamento
 * "sicuro": un index corrotto non blocca la run, viene rigenerato).
 *
 * @param {string} text
 * @returns {Array<object>}
 */
/** Normalizza un record grezzo nello schema RunIndexEntry (come lib/run-index.ts). */
function normalizeEntry(e) {
  const pass = count(e.pass);
  const fail = count(e.fail);
  const total = count(e.total) || pass + fail;
  const bugs = e.bugs && typeof e.bugs === 'object' ? e.bugs : {};
  const environments = Array.isArray(e.environments)
    ? e.environments
        .map((env) => ({
          browser: typeof env?.browser === 'string' ? env.browser : '',
          viewport: typeof env?.viewport === 'string' ? env.viewport : '',
        }))
        .filter((env) => env.browser)
    : [];

  const entry = {
    run: e.run,
    date: typeof e.date === 'string' ? e.date : '',
    status: e.status === 'PASS' || e.status === 'FAIL' ? e.status : '',
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.min(100, Math.max(0, Math.round(Number(e.passRate) || (pass / total) * 100))) : 0,
    bugs: { high: count(bugs.high), medium: count(bugs.medium), low: count(bugs.low) },
    duration: typeof e.duration === 'string' ? e.duration : '',
    cost: Number(e.cost) > 0 ? Math.round(Number(e.cost) * 1e6) / 1e6 : 0,
    environments,
  };
  if (typeof e.branch === 'string' && e.branch) entry.branch = e.branch;
  return entry;
}

export function parseRunIndex(text) {
  if (!text || typeof text !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e === 'object' && typeof e.run === 'string' && e.run)
    .map(normalizeEntry)
    // dedupe di sicurezza per `run` (tiene l'ultima occorrenza) + ordine desc,
    // stesso comportamento di parseRunIndex in lib/run-index.ts
    .sort((a, b) => b.run.localeCompare(a.run))
    .filter((e, i, arr) => i === 0 || arr[i - 1].run !== e.run);
}

/**
 * Upsert idempotente: inserisce/aggiorna `entry` (chiave `run`) in `entries`
 * preservando gli altri record, senza duplicati, ordinato dal più recente.
 *
 * @param {Array<object>} entries
 * @param {object} entry
 * @returns {Array<object>} nuovo array (non muta l'input)
 */
export function upsertRunIndex(entries, entry) {
  if (!entry?.run) return [...(entries ?? [])];
  const merged = (entries ?? []).filter((e) => e?.run !== entry.run);
  merged.push(entry);
  return merged.sort((a, b) => String(b.run).localeCompare(String(a.run)));
}

/**
 * Merge di due index (es. remoto su blob + locale della run corrente):
 * le entry di `localEntries` hanno la priorità sulle remote con stessa `run`.
 */
export function mergeRunIndex(remoteEntries, localEntries) {
  let merged = [...parseRunIndex(JSON.stringify(remoteEntries ?? []))];
  for (const entry of parseRunIndex(JSON.stringify(localEntries ?? []))) {
    merged = upsertRunIndex(merged, entry);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// I/O su file (reports/index.json)
// ---------------------------------------------------------------------------

/** Percorso di reports/index.json. */
export function runIndexPath(reportsDir) {
  return join(reportsDir, RUN_INDEX_FILE);
}

/**
 * Legge reports/index.json se esiste; ritorna il testo grezzo o '' se
 * il file è assente (la creazione è demandata alla prima scrittura).
 */
export function readRunIndexFile(reportsDir) {
  const path = runIndexPath(reportsDir);
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    console.warn(`[run-index] Impossibile leggere ${path}: ${err.message}`);
    return '';
  }
}

/** Scrive reports/index.json (crea la cartella reports se mancante). */
export function writeRunIndexFile(reportsDir, entries) {
  const path = runIndexPath(reportsDir);
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path, JSON.stringify(entries, null, 2), 'utf8');
  return path;
}