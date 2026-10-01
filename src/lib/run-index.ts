// Parsing/normalizzazione di reports/index.json — il file che alimenta la
// tabella della dashboard /reports. I tipi sono definiti in types/run-index.ts.
//
// Percorsi / variabili d'ambiente:
// - Locale:      <repo>/reports/index.json
// - Azure Blob:  blob "index.json" alla radice del container AZURE_STORAGE_CONTAINER
//                (default "e2e-reports"), pubblicato da upload-reports-to-azure.mjs
//
// La generazione lato script CI (scripts/run-index.mjs) segue lo stesso schema.

import type { RunIndexEntry } from '@/types/run-index';

function toCount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function toStatus(value: unknown): string {
    return value === 'PASS' || value === 'FAIL' ? value : '';
}

/**
 * Valida e normalizza un record grezzo di index.json.
 * Ritorna null se il record non è utilizzabile (manca `run`).
 */
export function normalizeRunIndexEntry(raw: unknown): RunIndexEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const e = raw as Record<string, unknown>;
    if (typeof e.run !== 'string' || !e.run) return null;

    const pass = toCount(e.pass);
    const fail = toCount(e.fail);
    const total = toCount(e.total) || pass + fail;
    const bugsRaw = (e.bugs ?? {}) as Record<string, unknown>;

    const environments = Array.isArray(e.environments)
        ? e.environments
            .map((env) => {
                const v = (env ?? {}) as Record<string, unknown>;
                return {
                    browser: typeof v.browser === 'string' ? v.browser : '',
                    viewport: typeof v.viewport === 'string' ? v.viewport : '',
                };
            })
            .filter((env) => env.browser)
        : [];

    const entry: RunIndexEntry = {
        run: e.run,
        date: typeof e.date === 'string' ? e.date : '',
        status: toStatus(e.status),
        pass,
        fail,
        total,
        passRate: total > 0 ? Math.min(100, Math.max(0, Math.round(Number(e.passRate) || (pass / total) * 100))) : 0,
        bugs: {
            high: toCount(bugsRaw.high),
            medium: toCount(bugsRaw.medium),
            low: toCount(bugsRaw.low),
        },
        duration: typeof e.duration === 'string' ? e.duration : '',
        cost: Number(e.cost) > 0 ? Math.round(Number(e.cost) * 1e6) / 1e6 : 0,
        environments,
    };
    if (typeof e.branch === 'string' && e.branch) entry.branch = e.branch;
    return entry;
}

/**
 * Parsa il contenuto testuale di index.json.
 * Casi limite gestiti in modo robusto (ritornando array vuoto):
 * - testo vuoto / null
 * - JSON malformato
 * - JSON valido ma non-array
 * - record singoli non validi (filtrati)
 */
export function parseRunIndex(text: string | null | undefined): RunIndexEntry[] {
    if (!text) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(normalizeRunIndexEntry)
        .filter((e): e is RunIndexEntry => e !== null)
        // dedupe di sicurezza per `run` (tiene l'ultima occorrenza) + ordine desc
        .sort((a, b) => b.run.localeCompare(a.run))
        .filter((e, i, arr) => i === 0 || arr[i - 1].run !== e.run);
}