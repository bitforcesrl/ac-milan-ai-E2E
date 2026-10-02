// Tipi condivisi del catalogo E2E definito in configs/index.ts.

export type E2ETest = {
    id: string;
    name: string;
    description: string;
    file: string;
    url: string;
    /** Se true, il test è preselezionato di default nel form home page. */
    default: boolean;
    /** Note opzionali precompilate per il test (override per-run dal form). */
    notes?: string;
};

export type BrowserConfig = {
    id: string;
    /** Etichetta leggibile mostrata nel form home page. */
    label: string;
    default: boolean;
};

export type ViewportConfig = {
    id: string;
    label: string;
    default: boolean;
};

export type MaxParallelSessions = {
    default: number;
    options: number[];
};