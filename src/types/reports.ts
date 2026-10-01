// Tipi condivisi dei report E2E (report su Azure Blob Storage).
// Unica fonte per lib/azure-reports.ts, gli endpoint /api/reports e le pagine /reports.

/** Metadata di run (<runId>/metadata.json). */
export type RunMeta = {
    run?: string;
    /** Data della run in UTC ISO (es. 2026-09-22T09:01:03Z). */
    date?: string;
    status?: string;
    /** Albero delle combinazioni testate: una voce per browser con i suoi viewport. */
    sessions?: Array<{ browser?: string; viewports?: string[] }>;
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
    tests?: Array<{ id?: string; name?: string; status?: string; report?: string }>;
    bugs?: { high?: number; medium?: number; low?: number };
    /** Costo AI della sessione in USD (somma dei costi OpenRouter). */
    cost?: number;
    reportPaths?: string[];
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
    tests: Array<{
        id: string;
        name: string;
        status: string;
        href: string; // link alla pagina di dettaglio test
    }>;
};

/** Risposta di GET /api/reports/{runId} e pagina di dettaglio run. */
export type RunDetail = RunSummary & {
    sessions: SessionView[];
};

/** Risposta di GET /api/reports/{runId}/{browser}/{viewport}/{testId}. */
export type TestDetail = {
    runId: string;
    browser: string;
    viewport: string;
    /** Contenuto Markdown del report del test (tests/<testId>.md). */
    report: string;
    status: string;
    screenshots: Array<{ name: string; url: string; description: string }>;
};