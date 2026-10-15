import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { PATHS_CONFIG } from '@/lib/e2e-tests';
import { parseRunIndex } from '@/lib/run-index';
import type { AppService } from '@/lib/services';
import type { RunningResult, RunningRun, TriggerRunResult } from '@/lib/services/types';
import type {
  RunDetail,
  RunMeta,
  RunSummary,
  SessionMeta,
  SessionView,
  TestDetail,
} from '@/types/reports';
import type { RunIndexEntry } from '@/types/run-index';

// LocalService: implementazione per la modalita' locale della dashboard
// (`npm run dev:local` -> E2E_LOCAL_MODE=1).
//
// - Run: invece di triggerare la pipeline Azure, esegue in background
//   scripts/run-e2e.mjs con la run config del form. Stato di "run in corso"
//   gestito con un lock file (.e2e-local/running.json con pid + startedAt):
//   rimosso al termine del processo figlio.
// - Report: lettura dal filesystem locale, stessa struttura che run-e2e.mjs
//   genera in reports/ e che upload-reports-to-azure.mjs carica su blob:
//
//   reports/<stamp>/metadata.json
//   reports/<stamp>/<browser>/<viewport>/metadata.json
//   reports/<stamp>/<browser>/<viewport>/tests/<testId>.md
//   reports/<stamp>/<browser>/<viewport>/screenshots/<testId>-*.png
//
//   Gli screenshot sono serviti dalla route /api/reports-asset/[...path]
//   (nessun SAS: i file sono locali).

const LOCAL_DIR = '.e2e-local';
const RUNNING_FILE = path.join(LOCAL_DIR, 'running.json');
const CONFIG_FILE = path.join(LOCAL_DIR, 'run-config.json');
const LOG_FILE = path.join(LOCAL_DIR, 'run.log');

const LOCAL_REPORTS_DIR = PATHS_CONFIG.reports;

const RUN_DIR_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Run: lock + spawn
// ---------------------------------------------------------------------------

type RunningInfo = { pid: number; startedAt: string };

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readRunningInfo(): RunningInfo | null {
  try {
    if (!existsSync(RUNNING_FILE)) return null;
    const info = JSON.parse(readFileSync(RUNNING_FILE, 'utf8')) as RunningInfo;
    if (!info?.pid || !isPidAlive(info.pid)) {
      // processo morto senza cleanup: rimuovi il lock
      rmSync(RUNNING_FILE, { force: true });
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report: lettura fs
// ---------------------------------------------------------------------------

/** Percorso sicuro dentro reports/: rifiuta path con '..' o assoluti. */
function safeLocalPath(...segments: string[]): string | null {
  const resolved = path.resolve(LOCAL_REPORTS_DIR, ...segments);
  const root = path.resolve(LOCAL_REPORTS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function readText(...segments: string[]): Promise<string | null> {
  const p = safeLocalPath(...segments);
  if (!p || !existsSync(p)) return null;
  try {
    return await readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function readJson<T>(...segments: string[]): Promise<T | null> {
  const text = await readText(...segments);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** URL locale per un asset (screenshot): servito da /api/reports-asset. */
function assetUrl(blobPath: string): string {
  const clean = blobPath.replace(/^(?:reports\/|raw\/)+/, '');
  return `/api/reports-asset/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

function sessionsFromRunMeta(runMeta: RunMeta): Array<{ browser: string; viewport: string }> {
  const sessions: Array<{ browser: string; viewport: string }> = [];
  for (const entry of runMeta.sessions ?? []) {
    if (!entry?.browser) continue;
    for (const viewport of entry.viewports ?? []) {
      if (viewport) sessions.push({ browser: entry.browser, viewport });
    }
  }
  return sessions;
}

function aggregate(
  tests: Array<{ status?: string }>,
  bugs: { high?: number; medium?: number; low?: number },
) {
  const pass = tests.filter((t) => t.status === 'PASS').length;
  const fail = tests.filter((t) => t.status === 'FAIL').length;
  const total = pass + fail;
  return {
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    bugs: {
      high: Number(bugs?.high) || 0,
      medium: Number(bugs?.medium) || 0,
      low: Number(bugs?.low) || 0,
    },
  };
}

function indexEntryToRunSummary(e: RunIndexEntry): RunSummary {
  return {
    runId: e.run,
    date: e.date || `${e.run.slice(0, 10)}T${e.run.slice(11).replace(/-/g, ':')}Z`,
    status: e.status,
    pass: e.pass,
    fail: e.fail,
    total: e.total,
    passRate: e.passRate,
    bugs: e.bugs,
    duration: e.duration,
    cost: e.cost ?? 0,
    environments: e.environments,
  };
}

function statusFrom(rawStatus: string, fail: number, total: number): string {
  return rawStatus === 'PASS' || rawStatus === 'FAIL'
    ? rawStatus
    : fail > 0
      ? 'FAIL'
      : total > 0
        ? 'PASS'
        : '';
}

/** Lista le run (cartelle <stamp> con metadata.json) in reports/. */
async function scanRunIds(): Promise<string[]> {
  const root = safeLocalPath();
  if (!root || !existsSync(root)) return [];
  const entries = await readdir(root);
  const runIds: string[] = [];
  for (const name of entries) {
    if (!RUN_DIR_RE.test(name)) continue;
    try {
      if ((await stat(path.join(root, name))).isDirectory()) runIds.push(name);
    } catch {
      // ignora
    }
  }
  return runIds.sort((a, b) => b.localeCompare(a));
}

// ---------------------------------------------------------------------------
// Servizio
// ---------------------------------------------------------------------------

export class LocalService implements AppService {
  // --- Run ---

  async getRunning(): Promise<RunningResult> {
    const info = readRunningInfo();
    const running: RunningRun[] = info
      ? [
          {
            id: 0,
            buildNumber: 'Run locale',
            status: 'inProgress',
            queueTime: info.startedAt,
          },
        ]
      : [];
    return { running };
  }

  /** Run in corso, versione best-effort per la UI (lista pagine report). */
  async listRunningBuilds(): Promise<RunningRun[]> {
    const { running } = await this.getRunning();
    return running;
  }

  async triggerRun(runConfigJson: string): Promise<TriggerRunResult> {
    if (readRunningInfo()) {
      return {
        ok: false,
        httpStatus: 409,
        error: 'Esiste già una run locale in corso: attendere il completamento.',
      };
    }

    // Override per la modalità locale: niente email (il report email non
    // viene inviato). browserMode arriva dal form (selettore headed/headless).
    let configWithOverrides = runConfigJson;
    try {
      configWithOverrides = JSON.stringify({
        ...JSON.parse(runConfigJson),
        emailRecipients: [],
      });
    } catch {
      // config gia' validata da parseRunConfig: non dovrebbe mai accadere
    }

    mkdirSync(LOCAL_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, configWithOverrides, 'utf8');

    const logFd = openSync(LOG_FILE, 'a');
    const childEnv = { ...process.env };
    delete childEnv.E2E_LOCAL_MODE; // il flag vale solo per la dashboard
    const child = spawn('node', ['scripts/run-e2e.mjs', '--config', CONFIG_FILE], {
      cwd: process.cwd(),
      stdio: ['ignore', logFd, logFd],
      env: childEnv,
    });

    const startedAt = new Date().toISOString();
    writeFileSync(
      RUNNING_FILE,
      JSON.stringify({ pid: child.pid ?? 0, startedAt }, null, 2),
      'utf8',
    );

    child.on('close', () => {
      try {
        rmSync(RUNNING_FILE, { force: true });
      } catch {
        // ignora
      }
    });

    return { ok: true, local: true, startedAt };
  }

  // --- Report ---

  async listRuns(): Promise<RunSummary[]> {
    // Fast path: reports/index.json (scritto da run-e2e.mjs via run-index.mjs)
    try {
      const indexText = await readText('index.json');
      const entries = parseRunIndex(indexText);
      if (entries.length > 0) {
        return entries.map(indexEntryToRunSummary);
      }
    } catch {
      // fallback a scansione
    }

    const runIds = await scanRunIds();
    const summaries: RunSummary[] = [];

    for (const runId of runIds) {
      const runMeta = await readJson<RunMeta>(runId, 'metadata.json');
      if (!runMeta) continue;

      const sessions = sessionsFromRunMeta(runMeta);
      const tests: Array<{ status?: string }> = [];
      const bugs = { high: 0, medium: 0, low: 0 };
      const environments: Array<{ browser: string; viewport: string }> = [];
      // Durata della run: dal metadata di run (wall-clock)
      const duration = runMeta.duration ?? '';
      let cost = 0;

      for (const { browser, viewport } of sessions) {
        const meta = await readJson<SessionMeta>(runId, browser, viewport, 'metadata.json');
        if (!meta) continue;
        tests.push(...(meta.tests ?? []));
        bugs.high += Number(meta.bugs?.high) || 0;
        bugs.medium += Number(meta.bugs?.medium) || 0;
        bugs.low += Number(meta.bugs?.low) || 0;
        environments.push({ browser, viewport });
        cost += Number(meta.cost) || 0;
      }

      const agg = aggregate(tests, bugs);
      summaries.push({
        runId,
        date: runMeta.date ?? `${runId.slice(0, 10)}T${runId.slice(11).replace(/-/g, ':')}Z`,
        status: statusFrom(
          typeof runMeta.status === 'string' ? runMeta.status : '',
          agg.fail,
          agg.total,
        ),
        ...agg,
        duration,
        cost: Math.round(cost * 1e6) / 1e6,
        environments,
      });
    }

    return summaries;
  }

  async getRun(runIdRaw: string): Promise<RunDetail | null> {
    const runId = decodeURIComponent(runIdRaw);
    if (!RUN_DIR_RE.test(runId)) return null;

    const runMeta = await readJson<RunMeta>(runId, 'metadata.json');
    if (!runMeta) return null;

    const sessionDirs = sessionsFromRunMeta(runMeta);
    const sessions: SessionView[] = [];
    const tests: Array<{ status?: string }> = [];
    const bugs = { high: 0, medium: 0, low: 0 };

    for (const { browser, viewport } of sessionDirs) {
      const meta = await readJson<SessionMeta>(runId, browser, viewport, 'metadata.json');
      if (!meta) continue;

      tests.push(...(meta.tests ?? []));
      bugs.high += Number(meta.bugs?.high) || 0;
      bugs.medium += Number(meta.bugs?.medium) || 0;
      bugs.low += Number(meta.bugs?.low) || 0;

      const testRows = [];
      for (const t of meta.tests ?? []) {
        const testId = t.id ?? '';
        testRows.push({
          id: testId,
          name: t.name || testId,
          status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
          duration: t.duration ?? '',
          href: testId
            ? `/reports/${runId}/${encodeURIComponent(browser)}/${encodeURIComponent(viewport)}/${encodeURIComponent(testId)}`
            : '',
        });
      }

      sessions.push({
        browser,
        viewport,
        status: meta.status === 'FAIL' ? 'FAIL' : meta.status === 'PASS' ? 'PASS' : '',
        model: meta.model ?? '',
        duration: meta.duration ?? '',
        summary: meta.summary ?? '',
        cost: Math.round((Number(meta.cost) || 0) * 1e6) / 1e6,
        pass: (meta.tests ?? []).filter((t) => t.status === 'PASS').length,
        fail: (meta.tests ?? []).filter((t) => t.status === 'FAIL').length,
        tests: testRows,
      });
    }

    const agg = aggregate(tests, bugs);

    return {
      runId,
      date: runMeta.date ?? `${runId.slice(0, 10)}T${runId.slice(11).replace(/-/g, ':')}Z`,
      status: statusFrom(
        typeof runMeta.status === 'string' ? runMeta.status : '',
        agg.fail,
        agg.total,
      ),
      ...agg,
      // Durata della run: dal metadata di run (wall-clock)
      duration: runMeta.duration ?? '',
      cost: Math.round(sessions.reduce((acc, s) => acc + s.cost, 0) * 1e6) / 1e6,
      environments: sessionDirs,
      sessions,
    };
  }

  async getTest(
    runIdRaw: string,
    browserRaw: string,
    viewportRaw: string,
    testIdRaw: string,
  ): Promise<TestDetail | null> {
    const runId = decodeURIComponent(runIdRaw);
    const browser = decodeURIComponent(browserRaw);
    const viewport = decodeURIComponent(viewportRaw);
    const testId = decodeURIComponent(testIdRaw);

    if (!RUN_DIR_RE.test(runId)) return null;

    const sessionMeta = await readJson<SessionMeta>(runId, browser, viewport, 'metadata.json');
    if (!sessionMeta) return null;

    const report = await readText(runId, browser, viewport, 'tests', `${testId}.md`);
    if (!report) return null;

    const entry = (sessionMeta.tests ?? []).find((t) => t.id === testId);
    const status = entry?.status ?? '';

    const screenshots = await Promise.all(
      (sessionMeta.screenshotPaths ?? [])
        .filter((p) => {
          const name = p.split('/').pop() ?? '';
          return name.startsWith(`${testId}-`);
        })
        .map(async (p) => {
          const clean = p.replace(/^(?:reports\/|raw\/)+/, '');
          return {
            name: clean.split('/').pop() ?? clean,
            url: assetUrl(clean),
            description: '',
          };
        }),
    );

    return {
      runId,
      browser,
      viewport,
      report,
      status,
      screenshots,
    };
  }
}
