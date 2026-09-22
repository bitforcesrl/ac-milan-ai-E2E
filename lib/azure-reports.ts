// Accesso server-side ai report E2E su Azure Blob Storage.
// La connection string resta SOLO lato server (Server Components / Route Handlers):
// al client vengono esposti solo URL firmati SAS per screenshot e asset.
//
// Layout su blob (container e2e-reports, prefisso e2e/), prodotto da run-e2e-ci.mjs:
//
//   e2e/<stamp>/metadata.json                                  ← metadata di run
//   e2e/<stamp>/<browser>/<viewport>/metadata.json             ← metadata di sessione
//   e2e/<stamp>/<browser>/<viewport>/tests/<testId>.json       ← report strutturato del test (schemaVersion 2)
//   e2e/<stamp>/<browser>/<viewport>/screenshots/<testId>-*.png

import {
    BlobServiceClient,
    ContainerSASPermissions,
    SASProtocol,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
} from '@azure/storage-blob';

// ---------------------------------------------------------------------------
// Tipi condivisi (schema JSON dei report)
// ---------------------------------------------------------------------------

export type BugEntry = {
    id?: string;
    severity?: string; // HIGH | MEDIUM | LOW
    title?: string;
    description?: string;
    stepsToReproduce?: string[];
    expected?: string;
    actual?: string;
    impact?: string;
    screenshots?: string[];
};

export type StepEntry = {
    title?: string;
    detail?: string;
    status?: string; // PASS | FAIL | INFO
};

export type ErrorEntry = {
    message?: string;
    context?: string;
};

export type ScreenshotEntry = {
    path?: string;
    description?: string;
};

/** Fragment JSON per test, scritto dall'agente (tests/<testId>.json). */
export type TestReport = {
    schemaVersion?: number;
    test?: string;
    testName?: string;
    testFile?: string;
    browser?: string;
    viewport?: string;
    model?: string;
    run?: string;
    status?: string; // PASS | FAIL
    duration?: string;
    startedAt?: string;
    finishedAt?: string;
    summary?: string;
    steps?: StepEntry[];
    errors?: ErrorEntry[];
    bugs?: BugEntry[];
    screenshots?: ScreenshotEntry[];
    hash?: string;
    timestamp?: string;
};

type SessionMeta = {
    browser?: string;
    viewport?: string;
    model?: string;
    run?: string;
    date?: string;
    duration?: string;
    status?: string;
    summary?: string;
    tests?: Array<{ id?: string; name?: string; status?: string; report?: string }>;
    bugs?: { high?: number; medium?: number; low?: number };
    reportPaths?: string[];
    screenshotPaths?: string[];
};

type RunMeta = {
    run?: string;
    /** Data della run in UTC ISO (es. 2026-09-22T09:01:03Z). */
    date?: string;
    status?: string;
    sessions?: string[];
};

export type RunSummary = {
    runId: string;
    /** Data della run in UTC ISO. */
    date: string;
    status: string;
    pass: number;
    fail: number;
    total: number;
    passRate: number;
    bugs: { high: number; medium: number; low: number };
    duration: string;
    environments: Array<{ browser: string; viewport: string }>;
};

export type SessionView = {
    browser: string;
    viewport: string;
    status: string;
    model: string;
    duration: string;
    summary: string;
    pass: number;
    fail: number;
    tests: Array<{
        id: string;
        name: string;
        status: string;
        href: string; // link alla pagina di dettaglio test
    }>;
    screenshots: Array<{ name: string; url: string }>;
};

export type RunDetail = RunSummary & {
    sessions: SessionView[];
};

export type TestDetail = {
    runId: string;
    browser: string;
    viewport: string;
    report: TestReport;
    status: string;
    screenshots: Array<{ name: string; url: string; description: string }>;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONTAINER_NAME =
    process.env.AZURE_STORAGE_CONTAINER?.trim() && !process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
        ? process.env.AZURE_STORAGE_CONTAINER.trim()
        : 'e2e-reports';

const PREFIX = (process.env.AZURE_REPORT_BLOB_PREFIX || 'e2e').replace(/^\/+|\/+$/g, '');
// I report sono caricati su blob da sync-history.mjs direttamente sotto <prefix>/


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

/** URL firmato SAS per un blob (screenshot e asset). */
export async function sasUrl(blobName: string): Promise<string> {
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

/** Lista le run (cartelle <stamp> con metadata.json) sotto il prefisso. */
async function scanRunIds(): Promise<string[]> {
    const { container } = await getContainer();

    const runIds = new Set<string>();
    for await (const blob of container.listBlobsFlat({ prefix: `${PREFIX}/` })) {
        const rel = blob.name.slice(PREFIX.length + 1);
        const runId = rel.split('/')[0];
        if (runId && RUN_DIR_RE.test(runId)) runIds.add(runId);
    }

    return [...runIds].sort((a, b) => b.localeCompare(a));
}

/** Elenco delle sessioni (browser/viewport) di una run, dai blob presenti. */
async function scanSessions(runId: string): Promise<Array<{ browser: string; viewport: string }>> {
    const { container } = await getContainer();

    const sessions = new Set<string>();
    for await (const blob of container.listBlobsFlat({ prefix: `${PREFIX}/${runId}/` })) {
        const rel = blob.name.slice(PREFIX.length + 1 + runId.length + 1);
        const parts = rel.split('/');
        if (parts.length >= 3 && parts[0] && parts[1]) sessions.add(`${parts[0]}/${parts[1]}`);
    }

    return [...sessions]
        .sort()
        .map((s) => {
            const [browser, viewport] = s.split('/');
            return { browser, viewport };
        });
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

/** Lista tutte le run con statistiche aggregate (vista index). */
export async function listRuns(): Promise<RunSummary[]> {
    const runIds = await scanRunIds();
    const summaries: RunSummary[] = [];

    for (const runId of runIds) {
        const runMeta = await downloadJson<RunMeta>(`${PREFIX}/${runId}/metadata.json`);
        if (!runMeta) continue;

        const sessions = await scanSessions(runId);
        const tests: Array<{ status?: string }> = [];
        const bugs = { high: 0, medium: 0, low: 0 };
        const environments: Array<{ browser: string; viewport: string }> = [];
        let duration = '';

        for (const { browser, viewport } of sessions) {
            const meta = await downloadJson<SessionMeta>(`${PREFIX}/${runId}/${browser}/${viewport}/metadata.json`);
            if (!meta) continue;
            tests.push(...(meta.tests ?? []));
            bugs.high += Number(meta.bugs?.high) || 0;
            bugs.medium += Number(meta.bugs?.medium) || 0;
            bugs.low += Number(meta.bugs?.low) || 0;
            environments.push({ browser, viewport });
            if (!duration && meta.duration) duration = meta.duration;
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
            environments,
        });
    }

    return summaries;
}

/** Dettaglio di una run: sessioni con test e screenshot. */
export async function getRun(runIdRaw: string): Promise<RunDetail | null> {
    const runId = decodeURIComponent(runIdRaw);
    if (!RUN_DIR_RE.test(runId)) return null;

    const runMeta = await downloadJson<RunMeta>(`${PREFIX}/${runId}/metadata.json`);
    if (!runMeta) return null;

    const sessionDirs = await scanSessions(runId);
    const sessions: SessionView[] = [];
    const tests: Array<{ status?: string }> = [];
    const bugs = { high: 0, medium: 0, low: 0 };

    for (const { browser, viewport } of sessionDirs) {
        const meta = await downloadJson<SessionMeta>(`${PREFIX}/${runId}/${browser}/${viewport}/metadata.json`);
        if (!meta) continue;

        tests.push(...(meta.tests ?? []));
        bugs.high += Number(meta.bugs?.high) || 0;
        bugs.medium += Number(meta.bugs?.medium) || 0;
        bugs.low += Number(meta.bugs?.low) || 0;

        const testRows = [];
        for (const t of meta.tests ?? []) {
            const testId = t.id || (t.report ? (t.report.split('/').pop() ?? '').replace(/\.json$/, '') : '');
            testRows.push({
                id: testId,
                name: t.name || testId,
                status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
                href: testId
                    ? `/reports/${runId}/${encodeURIComponent(browser)}/${encodeURIComponent(viewport)}/${encodeURIComponent(testId)}`
                    : '',
            });
        }

        const screenshots = await Promise.all(
            (meta.screenshotPaths ?? [])
                .map((p) => p.replace(/^(?:reports\/|raw\/)+/, ''))
                .filter(Boolean)
                .map(async (p) => ({
                    name: p.split('/').pop() ?? p,
                    url: await sasUrl(`${PREFIX}/${p}`),
                })),
        );

        sessions.push({
            browser,
            viewport,
            status: meta.status === 'FAIL' ? 'FAIL' : meta.status === 'PASS' ? 'PASS' : '',
            model: meta.model ?? '',
            duration: meta.duration ?? '',
            summary: meta.summary ?? '',
            pass: (meta.tests ?? []).filter((t) => t.status === 'PASS').length,
            fail: (meta.tests ?? []).filter((t) => t.status === 'FAIL').length,
            tests: testRows,
            screenshots,
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
        environments: sessionDirs,
        sessions,
    };
}

/** Dettaglio di un singolo test (report strutturato JSON). */
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
        `${PREFIX}/${runId}/${browser}/${viewport}/metadata.json`,
    );
    if (!sessionMeta) return null;

    const report = await downloadJson<TestReport>(
        `${PREFIX}/${runId}/${browser}/${viewport}/tests/${testId}.json`,
    );
    if (!report) return null;

    const entry = (sessionMeta.tests ?? []).find((t) => t.id === testId);
    const status = entry?.status ?? (report.status === 'FAIL' ? 'FAIL' : report.status === 'PASS' ? 'PASS' : '');

    const screenshots = await Promise.all(
        (report.screenshots ?? [])
            .filter((s) => s?.path)
            .map(async (s) => {
                const p = (s.path ?? '').replace(/^(?:reports\/|raw\/)+/, '');
                return {
                    name: p.split('/').pop() ?? p,
                    url: await sasUrl(`${PREFIX}/${p}`),
                    description: s.description ?? '',
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
