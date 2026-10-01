// Schema condiviso di reports/index.json — il file che alimenta la tabella
// della dashboard /reports. Tipi usati sia da lib/run-index.ts (parsing) sia
// da lib/azure-reports.ts (lettura) e documentati in AGENTS.e2e.md.
//
// Percorsi / variabili d'ambiente:
// - Locale:      <repo>/reports/index.json
// - Azure Blob:  blob "index.json" alla radice del container AZURE_STORAGE_CONTAINER
//                (default "e2e-reports"), pubblicato da upload-reports-to-azure.mjs
// - Azure CI:    la run scrive BUILD_SOURCEBRANCH nel campo opzionale `branch`
//
// Formato: array di RunIndexEntry, ordinato dal più recente al più vecchio
// (chiave primaria: `run`, lo stamp della run = nome cartella report).
// La scrittura è idempotente (upsert per `run`, nessun duplicato).

/** Conteggi bug per severità. */
export type RunIndexBugs = {
    high: number;
    medium: number;
    low: number;
};

/** Singola combinazione browser/viewport eseguita nella run. */
export type RunIndexEnvironment = {
    browser: string;
    viewport: string;
};

/**
 * Record di reports/index.json: esattamente i dati mostrati nella tabella
 * di /reports (allineato a RunSummary in types/reports.ts).
 */
export type RunIndexEntry = {
    /** Id della run (stamp UTC, es. "2026-09-28_10-07-34") = cartella report. */
    run: string;
    /** Data/ora di inizio run in UTC ISO (es. "2026-09-28T10:07:34Z"). */
    date: string;
    /** Esito complessivo: "PASS" | "FAIL". */
    status: string;
    /** Test superati. */
    pass: number;
    /** Test falliti. */
    fail: number;
    /** Totale test eseguiti (pass + fail). */
    total: number;
    /** Percentuale di successo (0-100, arrotondata). */
    passRate: number;
    /** Bug rilevati per severità. */
    bugs: RunIndexBugs;
    /** Durata della run (es. "12m 0s"), se disponibile. */
    duration: string;
    /** Combinazioni browser/viewport eseguite. */
    environments: RunIndexEnvironment[];
    /** Costo AI totale della run in USD (somma dei costi OpenRouter), 0 se non disponibile. */
    cost: number;
    /** Branch sorgente (solo su Azure Pipelines, es. "refs/heads/main"). */
    branch?: string;
};