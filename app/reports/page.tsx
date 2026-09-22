import Link from 'next/link';
import { listRuns, type RunSummary } from '@/lib/azure-reports';
import { listRunningBuilds } from '@/lib/azure-devops';
import { ArrowLeft } from '@deemlol/next-icons';
import RunRow from './RunRow';

export const dynamic = 'force-dynamic';

const muted = 'text-dark-grey';

export default async function ReportsPage() {
    let runs: RunSummary[] = [];
    let error: string | null = null;
    let runningBuilds: Awaited<ReturnType<typeof listRunningBuilds>> = [];

    try {
        runs = await listRuns();
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    runningBuilds = await listRunningBuilds();

    return (
        <div className="min-h-screen bg-white text-black antialiased">
            <header className="bg-black text-white">
                <div className="mx-auto max-w-7xl px-6 py-8">
                    <Link className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white" href="/"><ArrowLeft size={16} aria-hidden="true" /> Home</Link>
                    <h1 className="store-heading mb-4 text-3xl sm:text-4xl">AC Milan — Reports E2E</h1>
                    <p className="text-sm text-white">
                        Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot
                    </p>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
                {runningBuilds.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-grey bg-grey px-4 py-3 text-sm">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                        </span>
                        <span className="font-medium">
                            {runningBuilds.length === 1
                                ? '1 pipeline E2E è in corso'
                                : `${runningBuilds.length} pipeline E2E sono in corso`}
                        </span>
                        {runningBuilds.map((b) => (
                            <span
                                key={b.id}
                                className="rounded-full border border-dark-grey px-2.5 py-0.5 font-mono text-[0.72rem]"
                            >
                                {b.buildNumber} ({b.status})
                            </span>
                        ))}
                    </div>
                )}

                {error && (
                    <p className={`text-lg ${muted}`}>Errore di accesso ad Azure Blob: {error}</p>
                )}

                {!error && runs.length === 0 && <p className={`text-lg ${muted}`}>Nessuna esecuzione disponibile.</p>}

                {!error && runs.length > 0 && (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-grey bg-white shadow-sm">
                        <table className="w-full border-collapse text-[0.88rem]">
                            <thead>
                                <tr>
                                    {['Risultato', 'Esecuzione', 'Test superati', 'Browser', 'Viewport', 'Durata', 'Bug'].map((h) => (
                                        <th key={h} className="border-b-2 border-secondary px-3.5 py-3 text-left text-[0.72rem] font-bold uppercase tracking-wide text-dark-grey">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run) => (
                                    <RunRow key={run.runId} run={run} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}

