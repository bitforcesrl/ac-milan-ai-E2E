import { parseRunIndex } from '@/lib/run-index';
import type { AppService } from '@/lib/services';
import type { RunningResult, RunningRun, TriggerRunResult } from '@/lib/services/types';
import type {
  RunDetail,
  RunMeta,
  RunSummary,
  SessionMeta,
  SessionView,
  TestDetail,
} from '@/types/reports';
import type { RunIndexEntry } from '@/types/run-index';

// AzureService: implementazione di default di AppService.
//
// - Run: trigger della pipeline E2E su Azure DevOps tramite REST API.
// - Report: accesso server-side ai report E2E su Azure Blob Storage; la
//   connection string resta SOLO lato server (Server Components / Route
//   Handlers): al client vengono esposti solo URL firmati SAS per screenshot
//   e asset.
//
// Variabili d'ambiente richieste (solo server-side):
// - AZURE_DEVOPS_ORG: nome dell'organizzazione Azure DevOps
// - AZURE_DEVOPS_PROJECT: nome del progetto
// - AZURE_DEVOPS_PIPELINE_ID: id della definizione di build (pipeline)
// - AZURE_DEVOPS_PAT: Personal Access Token con permesso "Build (Read & Execute)"
// - AZURE_DEVOPS_BRANCH (opzionale, default: main)
// - AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_CONTAINER (report)
//
// Layout su blob (container e2e-reports, radice del container), prodotto da run-e2e.mjs:
//
//   <stamp>/metadata.json                                  ← metadata di run
//   <stamp>/<browser>/<viewport>/metadata.json             ← metadata di sessione
//   <stamp>/<browser>/<viewport>/tests/<testId>.md         ← report Markdown del test
//   <stamp>/<browser>/<viewport>/screenshots/<testId>-*.png

import {
  BlobServiceClient,
  ContainerSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

// ---------------------------------------------------------------------------
// Config Azure DevOps
// ---------------------------------------------------------------------------

function azureDevOpsConfig() {
  const org = process.env.AZURE_DEVOPS_ORG;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const pipelineId = process.env.AZURE_DEVOPS_PIPELINE_ID;
  const pat = process.env.AZURE_DEVOPS_PAT;
  const branch = process.env.AZURE_DEVOPS_BRANCH || 'main';

  if (!org || !project || !pipelineId || !pat) return null;
  return { org, project, pipelineId, pat, branch };
}

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
}

function buildsUrl(org: string, project: string, query?: string): string {
  const base = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/build/builds`;
  return query ? `${base}?${query}` : base;
}

function mapBuild(b: {
  id: number;
  buildNumber: string;
  status: string;
  queueTime?: string;
  _links?: { web?: { href?: string } };
}): RunningRun {
  return {
    id: b.id,
    buildNumber: b.buildNumber,
    status: b.status,
    queueTime: b.queueTime,
    webUrl: b._links?.web?.href,
  };
}

const RUNNING_QUERY = 'statusFilter=inProgress,notStarted&$top=10&api-version=7.1';

// ---------------------------------------------------------------------------
// Client blob (lazy, solo server)
// ---------------------------------------------------------------------------

const CONTAINER_NAME =
  process.env.AZURE_STORAGE_CONTAINER?.trim() &&
  !process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
    ? process.env.AZURE_STORAGE_CONTAINER.trim()
    : 'e2e-reports';

// I report sono caricati su blob da upload-reports-to-azure.mjs direttamente alla radice del container

const sasDays = 90;

function parseConnectionString(value: string) {
  const parts = Object.fromEntries(
    value
      .split(';')
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf('=');
        return [entry.slice(0, index), entry.slice(index + 1)];
      }),
  );
  if (!parts.AccountName || !parts.AccountKey) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING deve includere AccountName e AccountKey.');
  }
  return { accountName: parts.AccountName as string, accountKey: parts.AccountKey as string };
}

let cached: {
  container: ReturnType<BlobServiceClient['getContainerClient']>;
  sas: string;
} | null = null;

async function getContainer() {
  if (cached) return cached;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (!connectionString || connectionString.startsWith('$(')) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING non configurata.');
  }

  const { accountName, accountKey } = parseConnectionString(connectionString);
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(CONTAINER_NAME);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER_NAME,
      permissions: ContainerSASPermissions.parse('rl'),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + sasDays * 24 * 60 * 60 * 1000),
      protocol: SASProtocol.Https,
    },
    new StorageSharedKeyCredential(accountName, accountKey),
  ).toString();

  cached = { container, sas };
  return cached;
}

/** URL firmato SAS per un blob (screenshot e asset). Uso interno del modulo. */
async function sasUrl(blobName: string): Promise<string> {
  const { container, sas } = await getContainer();
  return `${container.url.replace(/\/$/, '')}/${blobName}?${sas}`;
}

async function downloadText(blobName: string): Promise<string | null> {
  const { container } = await getContainer();
  try {
    const res = await container.getBlockBlobClient(blobName).downloadToBuffer();
    return res.toString('utf8');
  } catch {
    return null; // blob assente
  }
}

async function downloadJson<T>(blobName: string): Promise<T | null> {
  const text = await downloadText(blobName);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper report (condivisi tra le implementazioni di lettura)
// ---------------------------------------------------------------------------

const RUN_DIR_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

/** Elenco delle sessioni (browser/viewport) di una run, dall'albero nel metadata di run. */
function sessionsFromRunMeta(runMeta: RunMeta): Array<{ browser: string; viewport: string }> {
  const sessions: Array<{ browser: string; viewport: string }> = [];
  for (const entry of runMeta.sessions ?? []) {
    if (!entry?.browser) continue;
    for (const viewport of entry.viewports ?? []) {
      if (viewport) sessions.push({ browser: entry.browser, viewport });
    }
  }
  return sessions;
}

function aggregate(
  tests: Array<{ status?: string }>,
  bugs: { high?: number; medium?: number; low?: number },
) {
  const pass = tests.filter((t) => t.status === 'PASS').length;
  const fail = tests.filter((t) => t.status === 'FAIL').length;
  const total = pass + fail;
  return {
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    bugs: {
      high: Number(bugs?.high) || 0,
      medium: Number(bugs?.medium) || 0,
      low: Number(bugs?.low) || 0,
    },
  };
}

/**
 * Converte un record di index.json (lib/run-index.ts) in RunSummary,
 * la forma consumata dalla tabella di /reports.
 */
function indexEntryToRunSummary(e: RunIndexEntry): RunSummary {
  return {
    runId: e.run,
    date: e.date || `${e.run.slice(0, 10)}T${e.run.slice(11).replace(/-/g, ':')}Z`,
    status: e.status,
    pass: e.pass,
    fail: e.fail,
    total: e.total,
    passRate: e.passRate,
    bugs: e.bugs,
    duration: e.duration,
    cost: e.cost ?? 0,
    environments: e.environments,
  };
}

// ---------------------------------------------------------------------------
// Servizio
// ---------------------------------------------------------------------------

export class AzureService implements AppService {
  // --- Run ---

  async getRunning(): Promise<RunningResult> {
    const config = azureDevOpsConfig();
    if (!config) {
      return {
        running: [],
        error:
          'Configurazione Azure DevOps mancante. Impostare AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PIPELINE_ID e AZURE_DEVOPS_PAT.',
        httpStatus: 500,
      };
    }

    const url = buildsUrl(
      config.org,
      config.project,
      `definitions=${config.pipelineId}&${RUNNING_QUERY}`,
    );

    try {
      const res = await fetch(url, {
        headers: { Authorization: authHeader(config.pat) },
        cache: 'no-store',
      });

      if (!res.ok) {
        return {
          running: [],
          error: `Azure DevOps ha risposto con status ${res.status}`,
          httpStatus: res.status,
        };
      }

      const data = await res.json();
      return { running: (data.value ?? []).map(mapBuild) };
    } catch (err) {
      return {
        running: [],
        error: 'Errore durante la chiamata ad Azure DevOps',
        details: err instanceof Error ? err.message : String(err),
        httpStatus: 502,
      };
    }
  }

  /**
   * Run in corso, versione best-effort per la UI (lista pagine report):
   * ritorna [] se la configurazione non è presente o in caso di errore
   * (la pagina dei report non deve rompersi per questo).
   */
  async listRunningBuilds(): Promise<RunningRun[]> {
    const { running } = await this.getRunning();
    return running;
  }

  async triggerRun(runConfigJson: string): Promise<TriggerRunResult> {
    const config = azureDevOpsConfig();
    if (!config) {
      return {
        ok: false,
        httpStatus: 500,
        error:
          'Configurazione Azure DevOps mancante. Impostare AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PIPELINE_ID e AZURE_DEVOPS_PAT.',
      };
    }

    // Verifica che non ci siano già build in corso o in coda per questa pipeline
    const checkUrl = buildsUrl(
      config.org,
      config.project,
      `definitions=${config.pipelineId}&${RUNNING_QUERY}`,
    );

    try {
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: authHeader(config.pat) },
        cache: 'no-store',
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const running = (checkData.value ?? []).map(mapBuild);

        if (running.length > 0) {
          return {
            ok: false,
            httpStatus: 409,
            error:
              'Esistono già run E2E in corso: attendere il completamento prima di avviarne una nuova.',
            running,
          };
        }
      }
      // Se il check fallisce si prosegue comunque con il trigger (best-effort)
    } catch {
      // Ignora errori di rete sul check: il trigger viene tentato comunque
    }

    const url = buildsUrl(config.org, config.project, 'api-version=7.1');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader(config.pat),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          definition: { id: Number(config.pipelineId) },
          sourceBranch: `refs/heads/${config.branch}`,
          templateParameters: {
            e2eRunConfig: runConfigJson,
            // Titolo fisso della run: usato dal name condizionale nel
            // YAML (buildTitle via REST viene ignorato da ADO).
            // NB: il titolo diventa build number, quindi non deve
            // contenere caratteri vietati (":", "/", "\"", ecc.).
            e2eRunTitle: `Run avviata dall'app E2E · ${new Date()
              .toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                dateStyle: 'short',
                timeStyle: 'short',
              })
              .replaceAll(':', '.')
              .replaceAll('/', '-')}`,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          ok: false,
          httpStatus: res.status,
          error: `Azure DevOps ha risposto con status ${res.status}`,
          details: data,
        };
      }

      return {
        ok: true,
        buildId: data.id,
        buildNumber: data.buildNumber,
        webUrl: data._links?.web?.href,
        status: data.status,
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: 502,
        error: 'Errore durante la chiamata ad Azure DevOps',
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // --- Report ---

  /**
   * Lista tutte le run con statistiche aggregate (vista index).
   *
   * Fast path: legge il blob "index.json" (alla radice del container, scritto e
   * mantenuto aggiornato dalla pipeline da scripts/run-index.mjs). Se il file è
   * assente, malformato o vuoto, ricade sulla scansione completa dei blob
   * (comportamento precedente), cosi' la tabella funziona anche per storici
   * generati prima dell'introduzione di index.json.
   */
  async listRuns(): Promise<RunSummary[]> {
    try {
      const indexText = await downloadText('index.json');
      const entries = parseRunIndex(indexText);
      if (entries.length > 0) {
        console.log(`[azure-service] listRuns: ${entries.length} run da index.json`);
        return entries.map(indexEntryToRunSummary);
      }
      console.warn(
        '[azure-service] listRuns: index.json assente/vuoto/malformato, fallback a scansione blob.',
      );
    } catch (err) {
      // Blob storage non raggiungibile o non configurato: lasciamo gestire
      // l'errore al flusso esistente (scanRunIds sollevera' lo stesso errore).
      console.warn(
        `[azure-service] listRuns: fast-path index.json fallito (${err instanceof Error ? err.message : String(err)}), fallback a scansione blob.`,
      );
    }

    const runIds = await this.scanRunIds();
    const summaries: RunSummary[] = [];

    for (const runId of runIds) {
      const runMeta = await downloadJson<RunMeta>(`${runId}/metadata.json`);
      if (!runMeta) continue;

      const sessions = sessionsFromRunMeta(runMeta);
      const tests: Array<{ status?: string }> = [];
      const bugs = { high: 0, medium: 0, low: 0 };
      const environments: Array<{ browser: string; viewport: string }> = [];
      // Durata della run: dal metadata di run (wall-clock)
      const duration = runMeta.duration ?? '';
      let cost = 0;

      for (const { browser, viewport } of sessions) {
        const meta = await downloadJson<SessionMeta>(
          `${runId}/${browser}/${viewport}/metadata.json`,
        );
        if (!meta) continue;
        tests.push(...(meta.tests ?? []));
        bugs.high += Number(meta.bugs?.high) || 0;
        bugs.medium += Number(meta.bugs?.medium) || 0;
        bugs.low += Number(meta.bugs?.low) || 0;
        environments.push({ browser, viewport });
        cost += Number(meta.cost) || 0;
      }

      const agg = aggregate(tests, bugs);
      const rawStatus = typeof runMeta.status === 'string' ? runMeta.status : '';

      summaries.push({
        runId,
        date: runMeta.date ?? `${runId.slice(0, 10)}T${runId.slice(11).replace(/-/g, ':')}Z`,
        status:
          rawStatus === 'PASS' || rawStatus === 'FAIL'
            ? rawStatus
            : agg.fail > 0
              ? 'FAIL'
              : agg.total > 0
                ? 'PASS'
                : '',
        ...agg,
        duration,
        cost: Math.round(cost * 1e6) / 1e6,
        environments,
      });
    }

    return summaries;
  }

  /** Lista le run (cartelle <stamp> con metadata.json) alla radice del container. */
  private async scanRunIds(): Promise<string[]> {
    const { container } = await getContainer();

    const runIds = new Set<string>();
    for await (const blob of container.listBlobsFlat()) {
      const runId = blob.name.split('/')[0];
      if (runId && RUN_DIR_RE.test(runId)) runIds.add(runId);
    }

    return [...runIds].sort((a, b) => b.localeCompare(a));
  }

  /** Dettaglio di una run: sessioni con test e screenshot. */
  async getRun(runIdRaw: string): Promise<RunDetail | null> {
    const runId = decodeURIComponent(runIdRaw);
    if (!RUN_DIR_RE.test(runId)) return null;

    const runMeta = await downloadJson<RunMeta>(`${runId}/metadata.json`);
    if (!runMeta) return null;

    const sessionDirs = sessionsFromRunMeta(runMeta);
    const sessions: SessionView[] = [];
    const tests: Array<{ status?: string }> = [];
    const bugs = { high: 0, medium: 0, low: 0 };

    for (const { browser, viewport } of sessionDirs) {
      const meta = await downloadJson<SessionMeta>(`${runId}/${browser}/${viewport}/metadata.json`);
      if (!meta) continue;

      tests.push(...(meta.tests ?? []));
      bugs.high += Number(meta.bugs?.high) || 0;
      bugs.medium += Number(meta.bugs?.medium) || 0;
      bugs.low += Number(meta.bugs?.low) || 0;

      const testRows = [];
      for (const t of meta.tests ?? []) {
        const testId = t.id ?? '';
        testRows.push({
          id: testId,
          name: t.name || testId,
          status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
          duration: t.duration ?? '',
          href: testId
            ? `/reports/${runId}/${encodeURIComponent(browser)}/${encodeURIComponent(viewport)}/${encodeURIComponent(testId)}`
            : '',
        });
      }

      sessions.push({
        browser,
        viewport,
        status: meta.status === 'FAIL' ? 'FAIL' : meta.status === 'PASS' ? 'PASS' : '',
        model: meta.model ?? '',
        duration: meta.duration ?? '',
        summary: meta.summary ?? '',
        cost: Math.round((Number(meta.cost) || 0) * 1e6) / 1e6,
        pass: (meta.tests ?? []).filter((t) => t.status === 'PASS').length,
        fail: (meta.tests ?? []).filter((t) => t.status === 'FAIL').length,
        tests: testRows,
      });
    }

    const agg = aggregate(tests, bugs);
    const rawStatus = typeof runMeta.status === 'string' ? runMeta.status : '';

    return {
      runId,
      date: runMeta.date ?? `${runId.slice(0, 10)}T${runId.slice(11).replace(/-/g, ':')}Z`,
      status:
        rawStatus === 'PASS' || rawStatus === 'FAIL'
          ? rawStatus
          : agg.fail > 0
            ? 'FAIL'
            : agg.total > 0
              ? 'PASS'
              : '',
      ...agg,
      // Durata della run: dal metadata di run (wall-clock)
      duration: runMeta.duration ?? '',
      cost: Math.round(sessions.reduce((acc, s) => acc + s.cost, 0) * 1e6) / 1e6,
      environments: sessionDirs,
      sessions,
    };
  }

  /** Dettaglio di un singolo test (report Markdown). */
  async getTest(
    runIdRaw: string,
    browserRaw: string,
    viewportRaw: string,
    testIdRaw: string,
  ): Promise<TestDetail | null> {
    const runId = decodeURIComponent(runIdRaw);
    const browser = decodeURIComponent(browserRaw);
    const viewport = decodeURIComponent(viewportRaw);
    const testId = decodeURIComponent(testIdRaw);

    if (!RUN_DIR_RE.test(runId)) return null;

    const sessionMeta = await downloadJson<SessionMeta>(
      `${runId}/${browser}/${viewport}/metadata.json`,
    );
    if (!sessionMeta) return null;

    const report = await downloadText(`${runId}/${browser}/${viewport}/tests/${testId}.md`);
    if (!report) return null;

    const entry = (sessionMeta.tests ?? []).find((t) => t.id === testId);
    const status = entry?.status ?? '';
    const duration = entry?.duration ?? '';

    // Screenshot del test: file in screenshots/ prefissati con "<testId>-"
    // (elencati in sessionMeta.screenshotPaths dalla pipeline).
    const screenshots = await Promise.all(
      (sessionMeta.screenshotPaths ?? [])
        .filter((p) => {
          const name = p.split('/').pop() ?? '';
          return name.startsWith(`${testId}-`);
        })
        .map(async (p) => {
          const clean = p.replace(/^(?:reports\/|raw\/)+/, '');
          return {
            name: clean.split('/').pop() ?? clean,
            url: await sasUrl(clean),
            description: '',
          };
        }),
    );

    return {
      runId,
      browser,
      viewport,
      report,
      status,
      duration,
      screenshots,
    };
  }
}
