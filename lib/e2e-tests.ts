// Wrapper tipizzato per config.js: unica fonte di verità per la lista dei test E2E,
// browser, viewport e modelli AI, condivisa tra gli script Node (run-e2e-ci.mjs, ecc.)
// e l'app Next.js (form home page).

import {
    E2E_TESTS,
    BROWSERS,
    VIEWPORTS,
    AI_MODELS,
    MAX_PARALLEL_SESSIONS,
} from "../config";

export type E2ETest = {
    id: string;
    name: string;
    file: string;
    url: string;
    enabled: boolean;
    notes: string;
};

export type BrowserConfig = {
    id: string;
    envKey: string;
    default: boolean;
};

export type ViewportConfig = {
    id: string;
    label: string;
    envKey: string;
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
 * Converte l'id di un test nel nome del parametro della pipeline Azure DevOps
 * (camelCase), es. 'quickbuy-cart-validation' -> 'quickbuyCartValidation'.
 * È lo stesso nome usato in `parameters:` in azure-pipelines.yml e inviato
 * come templateParameters dall'API /api/trigger-pipeline.
 */
export function testIdToPipelineParam(id: string): string {
    return id
        .split("-")
        .map((part, i) =>
            i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("");
}

/**
 * Converte l'id di un test nel nome della variabile d'ambiente E2E_TEST_*,
 * es. 'quickbuy-cart-validation' -> 'E2E_TEST_QUICKBUY_CART_VALIDATION'.
 */
export function testIdToEnvFlag(id: string): string {
    return "E2E_TEST_" + id.replace(/-/g, "_").toUpperCase();
}

/**
 * Converte l'id di un browser nel nome del parametro della pipeline,
 * es. 'chromium' -> 'runChromium'.
 */
export function browserIdToPipelineParam(id: string): string {
    return "run" + id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Converte l'id di un viewport nel nome del parametro della pipeline,
 * es. '1280x650' -> 'runDesktop' (usando il campo label in config.js).
 */
export function viewportIdToPipelineParam(label: string): string {
    return "run" + label;
}