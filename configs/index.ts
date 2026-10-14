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
  ViewportConfig
} from "../src/types/config";

export const E2E_TESTS: E2ETest[] = [
    {
        id: 'fail-test',
        name: 'Fail Test',
        description: 'Test di smoke che fallisce sempre, utile per verificare la pipeline e i report.',
        file: 'fail.test.md',
        url: 'https://store.acmilan.com',
        default: true
    },
    {
        id: 'pdp',
        name: 'PDP Personalization Flow',
        description: 'Verifica il flusso completo di personalizzazione della maglia sulla pagina prodotto.',
        file: 'pdp/pdp.test.md',
        url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
        default: false
    },
    {
        id: 'pdp-fuzzy',
        name: 'PDP Fuzzy Input Validation',
        description: 'Valida i campi di personalizzazione con input fuzzy/estremi per individuare bug.',
        file: 'pdp/pdp-fuzzy.test.md',
        url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
        default: false
    },
    {
        id: 'quickbuy-combinations',
        name: 'Quick-Buy Combinations',
        description: 'Testa le combinazioni di taglie e varianti nel flusso quick-buy.',
        file: 'quickbuy/quickbuy-combinations.test.md',
        url: 'https://store.acmilan.com/',
        default: false
    },
    {
        id: 'quickbuy-personalization',
        name: 'Quick-Buy Personalization',
        description: 'Verifica la personalizzazione della maglia direttamente dal flusso quick-buy.',
        file: 'quickbuy/quickbuy-personalization.test.md',
        url: 'https://store.acmilan.com/',
        default: false
    },
    {
        id: 'quickbuy-cart-validation',
        name: 'Quick-Buy Cart Validation',
        description: 'Valida prezzi, quantità e contenuti del carrello nel flusso quick-buy.',
        file: 'quickbuy/quickbuy-cart-validation.test.md',
        url: 'https://store.acmilan.com/',
        default: true
    },
];

// ============================================================================
// BROWSER & VIEWPORT: catalogo unico per script CI, file configs/*.json e
// form Next.js. Le selezioni per-flusso vivono in configs/ (manual,
// pull-request, health-check, local) o arrivano dal form come configJson inline.
// ============================================================================

export const BROWSERS: BrowserConfig[] = [
    { id: 'chromium', label: 'Chromium', default: true },
    { id: 'firefox', label: 'Firefox', default: false },
    { id: 'webkit', label: 'WebKit (Safari)', default: false },
];

// NOTE: per simulare ambienti tablet/mobile è necessario specificare il campo "device" corrispondente al device Playwright da emulare.
// altrimenti è come si stesse usando un device desktop,
export const VIEWPORTS: ViewportConfig[] = [
    { id: 'desktop', label: 'Desktop', default: true },
    { id: 'tablet', label: 'Tablet (iPad Pro 11)', default: false, device: 'iPad Pro 11' },
    { id: 'mobile', label: 'Mobile (iPhone 17 Pro)', default: false, device: 'iPhone 17 Pro' },
];

// Modelli AI OpenRouter disponibili (primo = default)
export const AI_MODELS: string[] = ['qwen/qwen3.7-plus', 'z-ai/glm-5.3-flash', 'deepseek/deepseek-v4.1-flash'];

// ============================================================================
// EMAIL: destinatari di default precompilati nel form Next.js quando la run
// viene avviata dall'app. La mail in quel caso viene inviata SEMPRE (pass o
// fail). Per run manuali/schedulate i destinatari vivono in
// configs/manual.config.json e configs/health-check.config.json
// (emailRecipients, invio solo su FAIL), per PR il destinatario e' l'autore
// della pull request (invio solo su FAIL).
// ============================================================================
export const DEFAULT_EMAIL_RECIPIENTS: string[] = [];


export const PROJECT_PROMPT: string = `
Istruzioni specifiche del progetto:
- Overlay di upsell nel carrello: quando si naviga al carrello dopo aver aggiunto un prodotto si apre AUTOMATICAMENTE
  un overlay di upsell. NON e' un errore: comportamento atteso, chiudilo con la "X" in alto a destra prima di
  procedere. NON documentarlo come bug.
- NON segnalare come bug: il nome del giocatore visualizzato in MAIUSCOLO (comportamento corretto e desiderato); taglie
  che non compaiono affatto (dipendono dalla configurazione del prodotto, alcune possono non esserci); l'overlay di upsell
  nel carrello (comportamento atteso, si chiude con la "X").
- Il sito e' uno shop e-commerce con personalizzazione prodotto (es. maglie personalizzabili): verifica la coerenza
  tra personalizzazione selezionata, anteprima e carrello, e che il prezzo finale rifletta le opzioni scelte.
`;


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