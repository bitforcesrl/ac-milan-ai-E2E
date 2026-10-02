// Wrapper tipizzato per config.js: unica fonte di verità per la lista dei test E2E,
// browser, viewport e modelli AI, condivisa tra gli script Node (run-e2e.mjs, ecc.)
// e l'app Next.js (form home page).

import {
    E2E_TESTS,
    BROWSERS,
    VIEWPORTS,
    AI_MODELS,
    MAX_PARALLEL_SESSIONS,
} from "../../config";

export type E2ETest = {
    id: string;
    name: string;
    description: string;
    file: string;
    url: string;
    enabled: boolean;
    notes: string;
};

export type BrowserConfig = {
    id: string;
    default: boolean;
};

export type ViewportConfig = {
    id: string;
    label: string;
    default: boolean;
};

export const E2E_TEST_LIST: E2ETest[] = E2E_TESTS as E2ETest[];
export const BROWSER_LIST: BrowserConfig[] = BROWSERS as BrowserConfig[];
export const VIEWPORT_LIST: ViewportConfig[] = VIEWPORTS as ViewportConfig[];
export const AI_MODEL_LIST: string[] = AI_MODELS as string[];
export const MAX_PARALLEL_SESSIONS_CONFIG: {
    default: number;
    options: number[];
} = MAX_PARALLEL_SESSIONS;

/**
 * Run config di default per il form home page: deriva dai campi `enabled` e
 * `default` del catalogo in config.js. Lo stesso shape viene usato dai file
 * configs/*.json (vedi configs/README.md) e validato da run-config-schema.ts.
 */
export function buildDefaultRunConfig() {
    return {
        tests: E2E_TEST_LIST.filter((t) => t.enabled).map((t) => ({
            id: t.id,
            notes: t.notes,
        })),
        browsers: BROWSER_LIST.filter((b) => b.default).map((b) => b.id),
        viewports: VIEWPORT_LIST.filter((v) => v.default).map((v) => v.id),
        aiModel: AI_MODEL_LIST[0],
        maxParallelSessions: MAX_PARALLEL_SESSIONS_CONFIG.default,
    };
}