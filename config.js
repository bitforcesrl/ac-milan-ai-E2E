const E2E_TESTS = [
  {
    id: 'fail-test',
    name: 'Fail Test (sanity check agente)',
    file: 'fail.test.md',
    url: 'https://store.acmilan.com',
    enabled: false,
    notes: '',
  },
  {
    id: 'pdp',
    name: 'PDP Personalization Flow',
    file: 'pdp/pdp.test.md',
    url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
    enabled: false,
    notes: '',
  },
  {
    id: 'pdp-fuzzy',
    name: 'PDP Fuzzy Input Validation',
    file: 'pdp/pdp-fuzzy.test.md',
    url: 'https://store.acmilan.com/products/acm-home-authentic-jersey',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-combinations',
    name: 'Quick-Buy Combinations',
    file: 'quickbuy/quickbuy-combinations.test.md',
    url: 'https://store.acmilan.com/',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-personalization',
    name: 'Quick-Buy Personalization',
    file: 'quickbuy/quickbuy-personalization.test.md',
    url: 'https://store.acmilan.com/',
    enabled: false,
    notes: '',
  },
  {
    id: 'quickbuy-cart-validation',
    name: 'Quick-Buy Cart Validation',
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
  { id: 'chromium', envKey: 'RUN_CHROMIUM', default: true },
  { id: 'firefox', envKey: 'RUN_FIREFOX', default: false },
  { id: 'webkit', envKey: 'RUN_WEBKIT', default: false },
];

/** @type {{ id: string, label: string, envKey: string, default: boolean }[]} */
const VIEWPORTS = [
  { id: '1280x650', label: 'Desktop', envKey: 'RUN_DESKTOP', default: true },
  { id: '768x1024', label: 'Tablet', envKey: 'RUN_TABLET', default: false },
  { id: '390x844', label: 'Mobile', envKey: 'RUN_MOBILE', default: false },
];

// Modelli AI OpenRouter disponibili (primo = default)
const AI_MODELS = ['qwen/qwen3.7-plus'];

// Sessioni in parallelo (browser x viewport)
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

// Prefisso fisso su Azure Blob Storage: lo storico si accumula sempre nello stesso path
const BLOB_PREFIX = 'e2e';

module.exports = {
  E2E_TESTS,
  BROWSERS,
  VIEWPORTS,
  AI_MODELS,
  MAX_PARALLEL_SESSIONS,
  PATHS,
  BLOB_PREFIX,
};
