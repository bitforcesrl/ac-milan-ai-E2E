// config.js - Configurazione centralizzata: test E2E, path dei report e costanti condivise
//
// Ogni test e' identificato da:
// - id:      identificatore univoco (usato per il flag env TEST_<ID in SNAKE_CASE>)
// - name:    nome univoco e descrittivo del test (usato nei report)
// - file:    percorso del file .md del test, relativo alla cartella tests/
// - url:     URL completo della pagina da testare
// - enabled: se true il test viene eseguito di default; se false viene skippato
//            (a meno che non sia abilitato esplicitamente via flag TEST_*)
// - notes:   note/istruzioni aggiuntive per l'esecuzione (stringa vuota se non presenti)
//
// Selezione dei test (in run-e2e-ci.mjs):
// - Ogni test ha un flag env TEST_<ID in SNAKE_CASE> (es. 'pdp-fuzzy' -> TEST_PDP_FUZZY)
// - Se almeno un flag TEST_* e' definito, SOLO i flag a true determinano cosa eseguire
// - Se nessun flag e' definito, vengono eseguiti i test con enabled: true
// - In Azure Pipeline i test sono passati come parametro object [{ id, enabled }] al
//   template templates/e2e-job.yml, che genera i flag TEST_* automaticamente
// - In locale i flag TEST_* si definiscono nel file .env (vedi .env.template)

/**
 * @typedef {Object} E2ETest
 * @property {string} id
 * @property {string} name
 * @property {string} file
 * @property {string} url
 * @property {boolean} enabled
 * @property {string} notes
 */

/** @type {E2ETest[]} */
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
// PATH & COSTANTI CONDIVISE tra gli script (run-e2e-ci, render-reports, upload-reports, email-report)
// ============================================================================

const PATHS = {
  // reports/: report JSON strutturati + screenshot + metadata generati dall'AI (run-e2e-ci.mjs),
  // pubblicati come artifact di pipeline e caricati su Azure Blob da sync-history.mjs
  reports: 'reports',
};

// Prefisso fisso su Azure Blob Storage: lo storico si accumula sempre nello stesso path
const BLOB_PREFIX = 'e2e';

module.exports = { E2E_TESTS, PATHS, BLOB_PREFIX };
