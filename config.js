const E2E_TESTS = [
  {
    id: 'fail-test',
    name: 'Fail Test',
    description: 'Test di smoke che fallisce sempre, utile per verificare la pipeline e i report.',
    file: 'fail.test.md',
    url: 'https://store.acmilan.com',
    enabled: true,
    notes: '',
  },
  {
    id: 'pdp',
    name: 'PDP Personalization Flow',
    description: 'Verifica il flusso completo di personalizzazione della maglia sulla pagina prodotto.',
    file: 'pdp/pdp.test.md',
    url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
    enabled: false,
    notes: '',
  },
  {
    id: 'pdp-fuzzy',
    name: 'PDP Fuzzy Input Validation',
    description: 'Valida i campi di personalizzazione con input fuzzy/estremi per individuare bug.',
    file: 'pdp/pdp-fuzzy.test.md',
    url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-combinations',
    name: 'Quick-Buy Combinations',
    description: 'Testa le combinazioni di taglie e varianti nel flusso quick-buy.',
    file: 'quickbuy/quickbuy-combinations.test.md',
    url: 'https://store.acmilan.com/',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-personalization',
    name: 'Quick-Buy Personalization',
    description: 'Verifica la personalizzazione della maglia direttamente dal flusso quick-buy.',
    file: 'quickbuy/quickbuy-personalization.test.md',
    url: 'https://store.acmilan.com/',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-cart-validation',
    name: 'Quick-Buy Cart Validation',
    description: 'Valida prezzi, quantità e contenuti del carrello nel flusso quick-buy.',
    file: 'quickbuy/quickbuy-cart-validation.test.md',
    url: 'https://store.acmilan.com/',
    enabled: true,
    notes: '',
  },
];

// ============================================================================
// BROWSER & VIEWPORT: unica fonte di verita' per script CI e form Next.js
// - envKey: variabile d'ambiente letta da run-e2e-ci.mjs (RUN_*)
// - default: usato quando la variabile non e' presente (locale) e come
//   default del form in home page
// ============================================================================

/** @type {{ id: string, envKey: string, default: boolean }[]} */
const BROWSERS = [
  { id: 'chromium', envKey: 'E2E_RUN_CHROMIUM', default: true },
  { id: 'firefox', envKey: 'E2E_RUN_FIREFOX', default: false },
  { id: 'webkit', envKey: 'E2E_RUN_WEBKIT', default: false },
];

/** @type {{ id: string, label: string, envKey: string, default: boolean }[]} */
const VIEWPORTS = [
  { id: '1280x650', label: 'Desktop', envKey: 'E2E_RUN_DESKTOP', default: true },
  { id: '768x1024', label: 'Tablet', envKey: 'E2E_RUN_TABLET', default: false },
  { id: '390x844', label: 'Mobile', envKey: 'E2E_RUN_MOBILE', default: false },
];

// Modelli AI OpenRouter disponibili (primo = default)
const AI_MODELS = ['qwen/qwen3.7-plus'];

// Sessioni in parallelo
const MAX_PARALLEL_SESSIONS = {
  default: 3,
  options: [1, 2, 3],
};

// ============================================================================
// PATH & COSTANTI CONDIVISE tra gli script (run-e2e-ci, render-reports, upload-reports, email-report)
// ============================================================================

const PATHS = {
  // reports/: report JSON strutturati + screenshot + metadata generati dall'AI (run-e2e-ci.mjs),
  // pubblicati come artifact di pipeline e caricati su Azure Blob da sync-history.mjs
  reports: 'reports',
};

module.exports = {
  E2E_TESTS,
  BROWSERS,
  VIEWPORTS,
  AI_MODELS,
  MAX_PARALLEL_SESSIONS,
  PATHS,
};
