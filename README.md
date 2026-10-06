# AI E2E Tests Harness

Harness per test E2E basati su AI (Playwright + OpenRouter) con dashboard Next.js per l'avvio delle run e la consultazione dei report, e pipeline Azure DevOps per l'esecuzione in CI.

## Stack

- **Next.js 16 (App Router)** + React 19 + TypeScript strict
- **Tailwind CSS 4** + Sass
- **React Query** (`@tanstack/react-query`) per lo stato server-side
- **React Hook Form + Zod** per form e validazione
- **Playwright** (`@playwright/test`) per i browser
- **Azure Blob Storage** per lo storage dei report
- **Azure DevOps REST API** per il trigger delle pipeline
- **SendGrid** per l'invio dei report via email
- **OpenRouter** come provider dei modelli AI

## Requisiti

- Node.js 22.x
- npm
- Un agent Azure DevOps con Docker (pool `Internal Linux with Docker`, JDK 21) per la CI

## Configurazione

### 1. Variabili d'ambiente

Copia il template e compila i valori:

```bash
cp .env.template .env
```

| Variabile | Descrizione |
|---|---|
| `NEXT_PUBLIC_CLIENT_NAME` | Nome del client mostrato nella dashboard (branding) |
| `OPENROUTER_API_KEY` | API key OpenRouter per i modelli AI usati nei test |
| `OPENROUTER_MAX_RETRIES` / `OPENROUTER_RETRY_BASE_MS` / `OPENROUTER_MAX_TURNS` | Tuning delle retry e del numero massimo di turni AI |
| `APP_PASSWORD` | Password per accedere alla dashboard Next.js |
| `APP_SESSION_SECRET` | Segreto per firmare il cookie di sessione (es. `openssl rand -hex 32`) |
| `APP_SESSION_TTL_HOURS` | Durata sessione in ore (default `168` = 7 giorni) |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string Azure Blob (usata dalla dashboard `/reports` e dagli script di upload/download) |
| `AZURE_STORAGE_CONTAINER` | Container dei report (default `e2e-reports`) |
| `AZURE_DEVOPS_ORG` / `AZURE_DEVOPS_PROJECT` | Organizzazione e progetto Azure DevOps |
| `AZURE_DEVOPS_PIPELINE_ID` | ID della definizione di build da eseguire |
| `AZURE_DEVOPS_PAT` | Personal Access Token con permesso **Build (Read & Execute)** |
| `AZURE_DEVOPS_BRANCH` | Branch su cui eseguire la pipeline (default `main`) |
| `EMAIL_SENDGRID_API_KEY` | API key SendGrid |
| `EMAIL_FROM` | Mittente della mail di report |
| `EMAIL_SCHEDULED_RECIPIENTS` | Destinatari per run trigger/schedule/manuale su `main` (separati da virgola; invio solo su FAIL) |
| `EMAIL_REPORT_HTML_URL` | URL della pagina HTML del report da includere nella mail |

### 2. Configurazione dei test (`configs/`)

Il catalogo dei test, browser, viewport e modelli AI disponibili è definito in [`configs/index.ts`](configs/index.ts:15):

- `E2E_TESTS`: elenco dei flussi di test (id, nome, file `.test.md`, URL target, flag `default`)
- `BROWSERS`: `chromium`, `firefox`, `webkit`
- `VIEWPORTS`: `1280x650` (Desktop), `768x1024` (Tablet), `390x844` (Mobile)
- `AI_MODELS`: modelli OpenRouter disponibili (il primo è il default)
- `DEFAULT_EMAIL_RECIPIENTS`: destinatari precompilati nel form della dashboard
- `MAX_PARALLEL_SESSIONS`: sessioni Playwright in parallelo (default `3`, opzioni `1–3`)

Le combinazioni effettive per ambiente sono nei file JSON:

- [`configs/pipeline.config.json`](configs/pipeline.config.json) — run su `main` (trigger/schedule/manuale)
- [`configs/pr.config.json`](configs/pr.config.json) — run su pull request (solo smoke)
- [`configs/local.config.json`](configs/local.config.json) — run locale (1 sessione parallela)

Ogni config contiene: `tests` (per id), `browsers`, `viewports`, `aiModel`, `maxParallelSessions`.

### 3. Azure DevOps

La pipeline è definita in [`azure-pipelines.yml`](azure-pipelines.yml:1):

- **Trigger**: push su `main`, PR su `main`, schedule giornaliero `0 6 * * *` (06:00 UTC, `always: true`)
- **Pool**: `Internal Linux with Docker` (richiede JDK 21)
- **Variable group**: `ai-e2e-secrets` — deve contenere tutte le variabili d'ambiente elencate sopra (OpenRouter, Azure Blob, SendGrid, email)
- **Variabile `E2E_RUN_CONFIG`**: dichiarata vuota perché l'app possa passarne il valore a queue-time via REST (`POST /api/azure-pipeline`); senza dichiarazione la macro non viene espansa

La pipeline esegue due job:

1. `resolve_flow` — [`scripts/resolve-flow.mjs`](scripts/resolve-flow.mjs) determina la modalità (PR / main / run da dashboard), il file di config e la policy di invio email, esportandoli come output variables
2. `e2e` — installa dipendenze e browser Playwright, esegue [`scripts/run-e2e.mjs`](scripts/run-e2e.mjs), carica i report su Azure Blob e invia la mail via SendGrid (`succeededOrFailed()`)

### 4. Azure Blob Storage

I report HTML delle run vengono caricati su un container Blob (default `e2e-reports`) e consultati dalla dashboard. Serve una connection string con permessi di lettura/scrittura sul container.

## Avvio

```bash
npm install
npm run dev        # dashboard su http://localhost:3000
```

Alla prima apertura viene richiesta la password (`APP_PASSWORD`) su `/login`; la sessione è un cookie firmato HMAC-SHA256 (`app_session`).

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` / `build` / `start` | Dashboard Next.js |
| `npm run lint` | ESLint |
| `npm run ci:resolve-flow` | Risolve modalità/config/email policy (usato in CI) |
| `npm run ci:run-e2e` | Esegue i test con `configs/pipeline.config.json` |
| `npm run ci:run-e2e-pr` | Esegue i test con `configs/pr.config.json` |
| `npm run ci:upload-reports` | Carica i report su Azure Blob |
| `npm run ci:send-email` | Invia il report via SendGrid |
| `npm run local:run-e2e` | Esegue i test con `configs/local.config.json` |
| `npm run local:download-reports` | Scarica i report da Azure Blob in locale |
| `npm run local:clear-azure` | Svuota il container Azure Blob |

## Come funziona

1. **Trigger di una run**: dalla dashboard (form in home) oppure automaticamente (push/PR/schedule su `main`). Il form invia una config JSON inline che viene passata alla pipeline come variabile `E2E_RUN_CONFIG` tramite `POST /api/azure-pipeline`.
2. **Esecuzione**: la pipeline risolve il flusso, esegue i test Playwright guidati dall'AI (OpenRouter) in parallelo sulle combinazioni browser × viewport selezionate.
3. **Report**: gli HTML vengono caricati su Azure Blob e sono consultabili nella dashboard su `/reports` (elenco run → dettaglio per browser/viewport/test).
4. **Email**: invio via SendGrid secondo policy — sempre per run avviate dalla dashboard, solo su FAIL per trigger/schedule e PR (destinatario: autore della PR).

## Struttura del progetto

```
configs/            # Catalogo test/browser/viewport + config per ambiente
scripts/            # Script CI/locali (run, upload/download, email, resolve-flow)
src/app/            # Dashboard Next.js (login, home, reports) + API routes
src/components/     # Componenti UI della dashboard
src/lib/            # Auth, client Azure DevOps/Blob, query, schema run config
src/types/          # Tipi TypeScript condivisi
azure-pipelines.yml # Pipeline Azure DevOps
```
