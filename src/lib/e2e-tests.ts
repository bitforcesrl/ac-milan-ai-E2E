// Re-export tipizzato di config.ts: unica fonte di verità per la lista dei test E2E,
// browser, viewport e modelli AI, condivisa tra gli script Node (run-e2e.mjs, ecc.)
// e l'app Next.js (form home page).

import {
    AI_MODELS,
    BROWSERS,
    E2E_TESTS,
    MAX_PARALLEL_SESSIONS,
    VIEWPORTS,
    type BrowserConfig,
    type E2ETest,
    type MaxParallelSessions,
    type ViewportConfig,
} from "../../config";

export type { BrowserConfig, E2ETest, MaxParallelSessions, ViewportConfig };

export const E2E_TEST_LIST: E2ETest[] = E2E_TESTS;
export const BROWSER_LIST: BrowserConfig[] = BROWSERS;
export const VIEWPORT_LIST: ViewportConfig[] = VIEWPORTS;
export const AI_MODEL_LIST: string[] = AI_MODELS;
export const MAX_PARALLEL_SESSIONS_CONFIG: MaxParallelSessions = MAX_PARALLEL_SESSIONS;

/**
 * Run config di default per il form home page: deriva dai campi `enabled` e
 * `default` del catalogo in config.ts. Lo stesso shape viene usato dai file
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