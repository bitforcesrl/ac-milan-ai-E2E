'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from '@deemlol/next-icons';
import RunRow from '@/components/RunRow';
import RunningRow from '@/components/RunningRow';
import type { RunSummary } from '@/lib/azure-reports';
import {
    fetchRunningBuilds,
    fetchRuns,
    queryKeys,
    type RunningBuild,
} from '@/lib/queries';

const POLL_INTERVAL_MS = 15_000;
/** Numero di run completate per pagina (paginazione lato client). */
const PAGE_SIZE = 10;

/** Stile dei pulsanti di paginazione. */
const PAGE_BUTTON_CLASS =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-sm border border-black/10 bg-white px-2 text-sm font-medium text-dark-grey transition-all duration-200 hover:border-black/25 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40';

/**
 * Tabella dei reports (client): renderizza le run completate e, in cima,
 * le pipeline attualmente in corso. Polla ogni 15 secondi entrambe le API
 * (`/api/reports` e `/api/azure-pipeline`) così le nuove run completate
 * appaiono automaticamente in tabella e le righe "in corso" si aggiornano
 * o scompaiono da sole.
 * I dati iniziali arrivano dal server (SSR), poi il client li aggiorna.
 */
export default function ReportsTable({
    initialRuns,
    initialRunningBuilds,
}: {
    initialRuns: RunSummary[];
    initialRunningBuilds: RunningBuild[];
}) {
    const [page, setPage] = useState(1);

    // Server state gestito da React Query: polling ogni 15s, dati iniziali da SSR
    const { data: runs = initialRuns } = useQuery({
        queryKey: queryKeys.runs,
        queryFn: fetchRuns,
        initialData: initialRuns,
        refetchInterval: POLL_INTERVAL_MS,
    });
    const { data: runningBuilds = initialRunningBuilds } = useQuery({
        queryKey: queryKeys.runningBuilds,
        queryFn: fetchRunningBuilds,
        initialData: initialRunningBuilds,
        refetchInterval: POLL_INTERVAL_MS,
    });

    // Paginazione lato client: solo le run completate; le pipeline in corso
    // restano sempre visibili in cima alla tabella.
    const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageRuns = useMemo(
        () => runs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [runs, safePage],
    );

    return (
        <div className="mt-2 overflow-x-auto rounded-xl border border-grey bg-white shadow-card animate-fade-up-lg">
            <table className="w-full border-collapse text-[0.88rem]">
                <thead>
                    <tr>
                        {['Risultato', 'Esecuzione', 'Test superati', 'Browser', 'Viewport', 'Durata', 'Costo', 'Bug'].map((h) => (
                            <th key={h} className="border-b-2 border-dark-grey bg-grey/50 px-3.5 py-3 text-left text-[0.72rem] font-bold uppercase tracking-wide text-dark-grey">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {runningBuilds.map((b, i) => (
                        <RunningRow key={b.id} build={b} style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                    {pageRuns.map((run, i) => (
                        <RunRow key={run.runId} run={run} style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }} />
                    ))}
                </tbody>
            </table>

            {/* Paginazione: precedente / numeri di pagina / successiva */}
            {totalPages > 1 && (
                <nav
                    aria-label="Paginazione reports"
                    className="flex items-center justify-between gap-3 border-t border-grey px-3.5 py-3"
                >
                    <span className="text-xs text-dark-grey">
                        {runs.length} esecuzioni · pagina {safePage} di {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPage(safePage - 1)}
                            disabled={safePage === 1}
                            className={PAGE_BUTTON_CLASS}
                            aria-label="Pagina precedente"
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setPage(n)}
                                aria-current={n === safePage ? 'page' : undefined}
                                className={
                                    n === safePage
                                        ? 'inline-flex h-8 min-w-8 items-center justify-center rounded-sm border border-primary bg-primary px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2'
                                        : PAGE_BUTTON_CLASS
                                }
                            >
                                {n}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPage(safePage + 1)}
                            disabled={safePage === totalPages}
                            className={PAGE_BUTTON_CLASS}
                            aria-label="Pagina successiva"
                        >
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
}
