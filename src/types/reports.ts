// Tipi condivisi dei report E2E (report su Azure Blob Storage).
// Unica fonte per lib/azure-reports.ts, gli endpoint /api/reports e le pagine /reports.

/** Metadata di run (<runId>/metadata.json). */
export type RunMeta = {
  run?: string;
  /** Data della run in UTC ISO (es. 2026-09-22T09:01:03Z). */
  date?: string;
  status?: string;
  /** Durata wall-clock dell'intera run (es. "2m 34s"). */
  duration?: string;
  /** Albero delle combinazioni testate: una voce per browser con i suoi viewport. */
  sessions?: Array<{ browser?: string; viewports?: string[] }>;
  /** Motivo dell'interruzione, se la run e' stata interrotta (credito LLM o segnale). */
  abort?: { kind?: string; reason?: string };
};

/** Esito di un test in un metadata di sessione. */
export type SessionTestMeta = {
  id?: string;
  name?: string;
  /** PASS | FAIL (esito reale) | ERROR (test non giunto a esito). */
  status?: string;
  duration?: string;
  /** Classe dell'errore quando status = ERROR (es. "llm_quota", "no_ci_status"). */
  errorType?: string;
  /** Motivo leggibile dell'errore o della provenienza dell'esito. */
  reason?: string;
  /** "agent-metadata" se l'esito e' letto dai metadata dell'agente (CI_STATUS assente). */
  statusSource?: string;
};

/** Metadata di sessione (<runId>/<browser>/<viewport>/metadata.json). */
export type SessionMeta = {
  browser?: string;
  viewport?: string;
  model?: string;
  run?: string;
  date?: string;
  duration?: string;
  status?: string;
  summary?: string;
  tests?: SessionTestMeta[];
  bugs?: { high?: number; medium?: number; low?: number };
  /** Costo AI della sessione in USD (somma dei costi OpenRouter). */
  cost?: number;
  screenshotPaths?: string[];
};

/** Riga della tabella /reports (record di index.json normalizzato). */
export type RunSummary = {
  runId: string;
  /** Data della run in UTC ISO. */
  date: string;
  status: string;
  pass: number;
  fail: number;
  /** Test non giunti a esito (ERROR). */
  error: number;
  total: number;
  passRate: number;
  bugs: { high: number; medium: number; low: number };
  duration: string;
  /** Costo AI totale della run in USD (0 se non disponibile). */
  cost: number;
  environments: Array<{ browser: string; viewport: string }>;
};

/** Sessione (browser/viewport) nel dettaglio di una run. */
export type SessionView = {
  browser: string;
  viewport: string;
  status: string;
  model: string;
  duration: string;
  summary: string;
  /** Costo AI della sessione in USD (0 se non disponibile). */
  cost: number;
  pass: number;
  fail: number;
  error: number;
  tests: Array<{
    id: string;
    name: string;
    status: string;
    /** Classe e motivo dell'errore (status ERROR) o nota sulla provenienza dell'esito. */
    errorType: string;
    reason: string;
    /** Durata del singolo test (es. "2m 34s"), se disponibile. */
    duration: string;
    href: string; // link alla pagina di dettaglio test
  }>;
};

/** Risposta di GET /api/reports/{runId} e pagina di dettaglio run. */
export type RunDetail = RunSummary & {
  sessions: SessionView[];
  /** Motivo dell'interruzione della run, se interrotta. */
  abortReason: string;
};

/** Risposta di GET /api/reports/{runId}/{browser}/{viewport}/{testId}. */
export type TestDetail = {
  runId: string;
  browser: string;
  viewport: string;
  /** Contenuto Markdown del report del test (tests/<testId>.md). */
  report: string;
  status: string;
  /** Classe e motivo dell'errore (status ERROR) o nota sulla provenienza dell'esito. */
  errorType: string;
  reason: string;
  /** URL del log completo della sessione del test, se disponibile. */
  logUrl: string;
  /** Durata del test (es. "2m 34s"), se disponibile. */
  duration: string;
  screenshots: Array<{ name: string; url: string; description: string }>;
};
