# AI E2E Tests Harness

Harness per test E2E basati su AI (Playwright + OpenRouter) con dashboard Next.js e pipeline Azure DevOps.

## Creazione nuovo progetto client — step by step

### 1. Repo

```bash
# clona l'harness
git clone git@ssh.dev.azure.com:v3/sintraconsulting/Bitforce/AI%20E2E%20tests%20-%20harness <client>-ai-e2e-tests
cd <client>-ai-e2e-tests

# crea il repo client su Azure DevOps, poi:
git remote set-url origin git@ssh.dev.azure.com:v3/sintraconsulting/<Progetto>/<Client>%20-%20AI%20E2E%20-%20tests
git remote add upstream git@ssh.dev.azure.com:v3/sintraconsulting/Bitforce/AI%20E2E%20tests%20-%20harness
git push -u origin main

# opzionale, mirror GitHub:
git remote add github git@github.com:bitforcesrl/<client>-ai-e2e.git
git push github main
```

### 2. Dipendenze

```bash
npm install          # installa anche i browser Playwright (postinstall)
cp .env.template .env
```

vedi `.env.template` per l'elenco completo delle variabili richieste.

### 3. Configurazione test

#### 3a. Scrivere i test — `tests/*.test.md`

I test si scrivono in **linguaggio naturale, in Markdown** (`.test.md`): non c'è codice Playwright. A ogni run un agente AI legge il file e segue le istruzioni per navigare il sito e verificare il flusso.

Regole pratiche:

- Un file = un flusso di test, organizzati in sottocartelle per area (es. `tests/pdp/`, `tests/quickbuy/`).
- Descrivi **obiettivo, passi attesi e cosa considerare bug/pass**: più sono precisi, più il test è deterministico.
- Il file viene letto dall'agente a runtime: non serve compilare nulla, basta salvarlo in `tests/`.

#### 3b. Registrare i test — [`configs/index.ts`](configs/index.ts)

Ogni test va aggiunto all'array `E2E_TESTS`:

```ts
{
    id: 'quickbuy-cart-validation',   // id univoco, usato nei file di config
    name: 'Quick-Buy Cart Validation',
    description: 'Valida prezzi, quantità e contenuti del carrello nel flusso quick-buy.',
    file: 'quickbuy/quickbuy-cart-validation.test.md',  // path relativo a tests/
    url: 'https://store.acmilan.com/',  // URL di partenza della run
    default: true                       // preselezionato nel form della dashboard
}
```

In `configs/index.ts` si definiscono anche: `BROWSERS` (chromium/firefox/webkit), `VIEWPORTS` (desktop/tablet/mobile), `AI_MODELS` (modelli OpenRouter, il primo è il default), `DEFAULT_EMAIL_RECIPIENTS` e `MAX_PARALLEL_SESSIONS`.

#### 3c. Config per ambiente — `configs/*.json`

Tre file che selezionano **quali test eseguire e con quali combinazioni** per ogni contesto. Ogni file contiene:

| Campo | Significato |
|---|---|
| `tests` | Elenco dei test per `id` (quelli registrati in `E2E_TESTS`) |
| `browsers` | Browser su cui eseguire (`chromium`, `firefox`, `webkit`) |
| `viewports` | Viewport (`1280x650` desktop, `768x1024` tablet, `390x844` mobile) |
| `aiModel` | Modello OpenRouter usato dall'agente |
| `maxParallelSessions` | Sessioni Playwright in parallelo (1–3) |
| `emailRecipients` | (solo pipeline) destinatari della mail di report |

- [`configs/pipeline.config.json`](configs/pipeline.config.json) — run manuali/schedule su `main`. Mail inviata solo su FAIL a `emailRecipients`.
- [`configs/pr.config.json`](configs/pr.config.json) — run su pull request: solo smoke (pochi test, 1 sessione). Mail su FAIL all'autore della PR.
- [`configs/local.config.json`](configs/local.config.json) — run locale (`npm run local:run-e2e`): 1 sessione parallela, nessuna mail.

Le run avviate dalla **dashboard** non usano questi file: la config arriva inline dal form (`E2E_RUN_CONFIG`).

### 4. Azure DevOps

1. Variable group `ai-e2e-secrets` (puoi modificare il nome nella [`azure-pipelines.yml`](azure-pipelines.yml)) con queste variabili (usate dalla pipeline per eseguire i test e inviare i report):

   ```
   AZURE_STORAGE_CONNECTION_STRING
   AZURE_STORAGE_CONTAINER
   EMAIL_FROM
   EMAIL_REPORT_HTML_URL
   NEXT_PUBLIC_CLIENT_NAME
   OPENROUTER_API_KEY
   SENDGRID_API_KEY
   ```

2. Nuova pipeline → seleziona il repo client → [`azure-pipelines.yml`](azure-pipelines.yml).
3. Annota l'ID della pipeline → `AZURE_DEVOPS_PIPELINE_ID` in `.env` e variable group.
4. Verifica pool agent: `Internal Linux with Docker` (JDK 21).
5. Verifica che la variabile `E2E_RUN_CONFIG` sia dichiarata (vuota) nella pipeline.

> Le altre variabili di `.env` (password dashboard, session secret, credenziali Azure DevOps, ecc.) non servono alla pipeline: servono quando si rilascia l'app Next.js (la dashboard), ad esempio su Vercel — vanno inserite nelle Environment Variables del progetto.

### 5. Azure Blob Storage

1. Storage account + container per i report (il nome non è fisso: qualunque nome va bene, va impostato in `AZURE_STORAGE_CONTAINER` nel variable group — default `e2e-reports`).
2. Connection string → variable group (`AZURE_STORAGE_CONNECTION_STRING`).

### 6. Verifica

```bash
npm run dev              # dashboard su http://localhost:3000
npm run local:run-e2e    # run locale
```

Poi triggera una run dalla dashboard o manualmente dalla pipeline.

## Sincronizzazione con l'harness

Utility npm:

| Comando | Descrizione |
|---|---|
| `npm run sync:status` | Mostra i commit dell'harness non ancora merged (nessuna modifica) |
| `npm run sync:pull` | Fetch + merge da `upstream` |
| `npm run sync:pr` | Pusha il branch corrente sull'`upstream` per contribuire una modifica all'harness (poi apri la PR su Azure DevOps) |


Non modificare i file dell'harness (`scripts/`, `src/`, `azure-pipelines.yml`, `package.json`, `configs/index.ts`): il client tocca solo `configs/*.json`, `tests/`, `.env`.

