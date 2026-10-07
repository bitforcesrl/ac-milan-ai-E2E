import type {
    BrowserConfig,
    E2ETest,
    MaxParallelSessions,
    ViewportConfig,
} from "../src/types/config";

export type {
    BrowserConfig,
    E2ETest,
    MaxParallelSessions,
    ViewportConfig,
} from "../src/types/config";

export const E2E_TESTS: E2ETest[] = [
    // Aggiungi qui i test del progetto, esempio:
    // {
    //     id: 'my-test',
    //     name: 'My Test',
    //     description: 'Descrizione del test.',
    //     file: 'my-test.test.md',
    //     url: 'https://example.com',
    //     default: true
    // },
];

// ============================================================================
// BROWSER & VIEWPORT: catalogo unico per script CI, file configs/*.json e
// form Next.js. Le selezioni per-flusso vivono in configs/ (pipeline, local,
// mr) o arrivano dal form come configJson inline.
// ============================================================================

export const BROWSERS: BrowserConfig[] = [
    { id: 'chromium', label: 'Chromium', default: true },
    { id: 'firefox', label: 'Firefox', default: false },
    { id: 'webkit', label: 'WebKit (Safari)', default: false },
];

export const VIEWPORTS: ViewportConfig[] = [
    { id: '1280x650', label: 'Desktop', default: true },
    { id: '768x1024', label: 'Tablet', default: false },
    { id: '390x844', label: 'Mobile', default: false },
];

// Modelli AI OpenRouter disponibili (primo = default)
export const AI_MODELS: string[] = ['qwen/qwen3.7-plus', 'z-ai/glm-5.3-flash', 'deepseek/deepseek-v4.1-flash'];

// ============================================================================
// EMAIL: destinatari di default precompilati nel form Next.js quando la run
// viene avviata dall'app. La mail in quel caso viene inviata SEMPRE (pass o
// fail). Per run trigger/schedule i destinatari vivono in
// configs/pipeline.config.json (emailRecipients, invio solo su FAIL), per
// PR il destinatario e' l'autore della pull request (invio solo su FAIL).
// ============================================================================
export const DEFAULT_EMAIL_RECIPIENTS: string[] = [];

// Sessioni in parallelo
export const MAX_PARALLEL_SESSIONS: MaxParallelSessions = {
    default: 3,
    options: [1, 2, 3],
};

// ============================================================================
// PATH & COSTANTI CONDIVISE tra gli script (run-e2e-ci, render-reports, upload-reports, email-report)
// ============================================================================

export const PATHS = {
    // reports/: report JSON strutturati + screenshot + metadata generati dall'AI (run-e2e-ci.mjs),
    // pubblicati come artifact di pipeline e caricati su Azure Blob da sync-history.mjs
    reports: 'reports',
} as const;