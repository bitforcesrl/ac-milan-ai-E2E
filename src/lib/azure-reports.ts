import { parseRunIndex } from '@/lib/run-index';
import type {
    RunDetail,
    RunMeta,
    RunSummary,
    SessionMeta,
    SessionView,
    TestDetail,
} from '@/types/reports';
import type { RunIndexEntry } from '@/types/run-index';

// Accesso server-side ai report E2E su Azure Blob Storage.
// La connection string resta SOLO lato server (Server Components / Route Handlers):
// al client vengono esposti solo URL firmati SAS per screenshot e asset.
//
// Layout su blob (container e2e-reports, radice del container), prodotto da run-e2e-ci.mjs:
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
// Tipi: definiti in types/reports.ts e types/run-index.ts (ri-esportati per
// compatibilità con i consumer esistenti che importano da '@/lib/azure-reports')
// ---------------------------------------------------------------------------

export type {
    RunDetail,
    RunSummary,
    SessionView,
    TestDetail,
} from '@/types/reports';
export type { RunIndexEntry } from '@/types/run-index';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONTAINER_NAME =
    process.env.AZURE_STORAGE_CONTAINER?.trim() && !process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
        ? process.env.AZURE_STORAGE_CONTAINER.trim()
        : 'e2e-reports';

// I report sono caricati su blob da upload-reports-to-azure.mjs direttamente alla radice del container


const sasDays = 90;

// ---------------------------------------------------------------------------
// Client blob (lazy, solo server)
// ---------------------------------------------------------------------------

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
// Scansione runs
// ---------------------------------------------------------------------------

const RUN_DIR_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

/** Lista le run (cartelle <stamp> con metadata.json) alla radice del container. */
async function scanRunIds(): Promise<string[]> {
    const { container } = await getContainer();

    const runIds = new Set<string>();
    for await (const blob of container.listBlobsFlat()) {
        const runId = blob.name.split('/')[0];
        if (runId && RUN_DIR_RE.test(runId)) runIds.add(runId);
    }

    return [...runIds].sort((a, b) => b.localeCompare(a));
}

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

function aggregate(tests: Array<{ status?: string }>, bugs: { high?: number; medium?: number; low?: number }) {
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

/**
 * Lista tutte le run con statistiche aggregate (vista index).
 *
 * Fast path: legge il blob "index.json" (alla radice del container, scritto e
 * mantenuto aggiornato dalla pipeline da scripts/run-index.mjs). Se il file è
 * assente, malformato o vuoto, ricade sulla scansione completa dei blob
 * (comportamento precedente), cosi' la tabella funziona anche per storici
 * generati prima dell'introduzione di index.json.
 */
export async function listRuns(): Promise<RunSummary[]> {
    try {
        const indexText = await downloadText('index.json');
        const entries = parseRunIndex(indexText);
        if (entries.length > 0) {
            console.log(`[azure-reports] listRuns: ${entries.length} run da index.json`);
            return entries.map(indexEntryToRunSummary);
        }
        console.warn('[azure-reports] listRuns: index.json assente/vuoto/malformato, fallback a scansione blob.');
    } catch (err) {
        // Blob storage non raggiungibile o non configurato: lasciamo gestire
        // l'errore al flusso esistente (scanRunIds sollevera' lo stesso errore).
        console.warn(`[azure-reports] listRuns: fast-path index.json fallito (${err instanceof Error ? err.message : String(err)}), fallback a scansione blob.`);
    }

    const runIds = await scanRunIds();
    const summaries: RunSummary[] = [];

    for (const runId of runIds) {
        const runMeta = await downloadJson<RunMeta>(`${runId}/metadata.json`);
        if (!runMeta) continue;

        const sessions = sessionsFromRunMeta(runMeta);
        const tests: Array<{ status?: string }> = [];
        const bugs = { high: 0, medium: 0, low: 0 };
        const environments: Array<{ browser: string; viewport: string }> = [];
        let duration = '';
        let cost = 0;

        for (const { browser, viewport } of sessions) {
            const meta = await downloadJson<SessionMeta>(`${runId}/${browser}/${viewport}/metadata.json`);
            if (!meta) continue;
            tests.push(...(meta.tests ?? []));
            bugs.high += Number(meta.bugs?.high) || 0;
            bugs.medium += Number(meta.bugs?.medium) || 0;
            bugs.low += Number(meta.bugs?.low) || 0;
            environments.push({ browser, viewport });
            if (!duration && meta.duration) duration = meta.duration;
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

/** Dettaglio di una run: sessioni con test e screenshot. */
export async function getRun(runIdRaw: string): Promise<RunDetail | null> {
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
            const testId = t.id || (t.report ? (t.report.split('/').pop() ?? '').replace(/\.md$/, '') : '');
            testRows.push({
                id: testId,
                name: t.name || testId,
                status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
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
        duration: sessions.find((s) => s.duration)?.duration ?? '',
        cost: Math.round(sessions.reduce((acc, s) => acc + s.cost, 0) * 1e6) / 1e6,
        environments: sessionDirs,
        sessions,
    };
}

/** Dettaglio di un singolo test (report Markdown). */
export async function getTest(
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

    const report = await downloadText(
        `${runId}/${browser}/${viewport}/tests/${testId}.md`,
    );
    if (!report) return null;

    const entry = (sessionMeta.tests ?? []).find((t) => t.id === testId);
    const status = entry?.status ?? '';

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
        screenshots,
    };
}
