"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Cpu } from "@deemlol/next-icons";
import { fetchRunningBuilds, queryKeys, type RunningBuild } from "@/lib/queries";

const POLL_INTERVAL_MS = 15_000;

/**
 * Banner mostrato in home page quando è in corso (o in coda) una run della pipeline.
 * Polla l'API `/api/azure-pipeline` (GET) ogni 15 secondi.
 */
export default function RunningPipelineBanner() {
    // Server state gestito da React Query: polling ogni 15s, best-effort
    const { data: running } = useQuery<RunningBuild[]>({
        queryKey: queryKeys.runningBuilds,
        queryFn: async () => {
            try {
                return await fetchRunningBuilds();
            } catch {
                // best-effort: il banner non deve rompere la pagina
                return [];
            }
        },
        refetchInterval: POLL_INTERVAL_MS,
        initialData: [],
    });

    if (running.length === 0) return null;

    const queued = running.filter((b) => b.status === "notStarted").length;
    const inProgress = running.length - queued;

    return (
        <div
            role="status"
            className="relative mb-6 overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] via-primary/[0.08] to-primary/[0.04] px-5 py-4 shadow-card animate-fade-up"
        >
            {/* barra di shimmer in cima */}
            <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>

                <Cpu size={18} aria-hidden="true" className="shrink-0 text-primary" />

                <span className="text-sm font-semibold text-black">
                    {running.length === 1
                        ? "Una run della pipeline è in corso"
                        : `${running.length} run della pipeline sono attive`}
                </span>

                <span className="text-sm text-dark-grey">
                    {inProgress > 0 && queued > 0
                        ? `(${inProgress} in esecuzione, ${queued} in coda)`
                        : queued > 0
                            ? "(in coda di avvio)"
                            : "(gli agenti AI stanno lavorando…)"}
                </span>

                <div className="ml-auto flex items-center gap-3">
                    {running.map((b) => (
                        <span
                            key={b.id}
                            className="flex items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1 text-xs font-medium text-primary"
                            title={`Build ${b.buildNumber}`}
                        >
                            {b.buildNumber}
                        </span>
                    ))}
                    <Link
                        href="/reports"
                        className="text-xs font-semibold text-primary underline underline-offset-2 transition-colors hover:text-black"
                    >
                        Vai ai report →
                    </Link>
                </div>
            </div>
        </div>
    );
}