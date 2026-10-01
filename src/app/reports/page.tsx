import type { Metadata } from 'next';
import Link from 'next/link';
import { listRuns, type RunSummary } from '@/lib/azure-reports';
import { listRunningBuilds } from '@/lib/azure-devops';
import { FileText } from '@deemlol/next-icons';
import ReportsTable from '@/components/ReportsTable';
import PageHeader from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Reports',
    description:
        'Resoconto esecuzioni della pipeline: dettaglio test eseguiti, bug riscontrati e screenshot',
};

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
    const hasReports = runs.length > 0 || runningBuilds.length > 0;
    return (
        <div className="min-h-screen bg-white text-black antialiased">
            <PageHeader
                title={`${process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Client"} — Reports E2E`}
                description="Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot"
                backLink={{ href: '/', label: 'Home' }}
            />
            <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
                {error && (
                    <p className={`text-lg ${muted}`}>Errore di accesso ad Azure Blob: {error}</p>
                )}

                {!error && !hasReports && (
                    <div className="mt-2 flex flex-col items-center gap-3 rounded-xl border border-grey bg-grey/40 px-6 py-16 text-center shadow-card animate-fade-up">
                        <FileText size={40} aria-hidden="true" className="text-dark-grey transition-transform duration-300 hover:scale-110" />
                        <p className={`text-lg font-medium ${muted}`}>Nessuna esecuzione disponibile</p>
                        <p className="max-w-sm text-sm text-dark-grey">
                            Avvia la prima pipeline di test per generare un report con esiti, bug e screenshot.
                        </p>
                        <Link
                            href="/"
                            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                        >
                            Avvia il primo test
                        </Link>
                    </div>
                )}

                {!error && hasReports && (
                    <ReportsTable initialRuns={runs} initialRunningBuilds={runningBuilds} />
                )}
            </main>
        </div>
    );
}

