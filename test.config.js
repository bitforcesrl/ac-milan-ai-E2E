// test.config.js - Definizione centralizzata dei test E2E
//
// Ogni test e' identificato da:
// - id:      identificatore univoco (usato in TESTS_ENABLED per abilitarlo in CI/locale)
// - name:    nome univoco e descrittivo del test (usato nei report)
// - file:    percorso del file .md del test, relativo alla cartella tests/
// - url:     URL completo della pagina da testare
// - enabled: se true il test viene eseguito di default; se false viene skippato
//            (a meno che non sia abilitato esplicitamente via TESTS_ENABLED)
// - notes:   note/istruzioni aggiuntive per l'esecuzione (stringa vuota se non presenti)
//
// Selezione dei test:
// - Se TESTS_ENABLED e' definita (lista di id separati da virgole), vengono eseguiti
//   SOLO i test con quegli id (override del campo enabled)
// - Se TESTS_ENABLED non e' definita, vengono eseguiti i test con enabled: true
// - In Azure Pipeline ogni test ha un parametro booleano che, se true,
//   aggiunge l'id alla variabile d'ambiente TESTS_ENABLED
// - In locale si usa la variabile TESTS_ENABLED nel file .env

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

module.exports = { E2E_TESTS };
