import Link from 'next/link';
import { listRuns, type RunSummary } from '@/lib/azure-reports';
import { CheckCircle, XCircle, HelpCircle } from '@deemlol/next-icons';

export const dynamic = 'force-dynamic';

const root = 'min-h-screen bg-slate-50 text-slate-900 antialiased';
const muted = 'text-slate-500';
const chip = 'inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap';

function statusIconSvg(kind: 'pass' | 'fail' | 'unknown') {
    if (kind === 'pass')
        return <CheckCircle size={22} aria-hidden="true" className="text-green-600" />;
    if (kind === 'fail')
        return <XCircle size={22} aria-hidden="true" className="text-red-600" />;
    return <HelpCircle size={22} aria-hidden="true" className="text-slate-400" />;
}

export default async function ReportsPage() {
    let runs: RunSummary[] = [];
    let error: string | null = null;

    try {
        runs = await listRuns();
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    return (
        <div className={root}>
            <main className="mx-auto max-w-7xl px-6 pt-10 pb-24">
                <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">Report E2E</h1>
                <p className={`mb-10 text-lg ${muted}`}>
                    Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot
                </p>

                {error && (
                    <p className={`text-lg ${muted}`}>Errore di accesso ad Azure Blob: {error}</p>
                )}

                {!error && runs.length === 0 && <p className={`text-lg ${muted}`}>Nessuna esecuzione disponibile.</p>}

                {!error && runs.length > 0 && (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full border-collapse text-[0.88rem]">
                            <thead>
                                <tr>
                                    {['Risultato', 'Esecuzione', 'Test superati', 'Browser', 'Viewport', 'Durata', 'Bug'].map((h) => (
                                        <th key={h} className={`border-b border-slate-200 px-3.5 py-2.5 text-left text-[0.72rem] font-semibold uppercase tracking-wide ${muted}`}>
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

function RunRow({ run }: { run: RunSummary }) {
    const statusKind = run.status === 'PASS' ? 'pass' : run.status === 'FAIL' ? 'fail' : 'unknown';
    const statusText = run.status === 'PASS' ? 'Successo' : run.status === 'FAIL' ? 'Fallito' : 'Sconosciuto';
    const ok = run.total > 0 && run.fail === 0;
    const outcomeClass = ok ? 'text-green-600' : run.fail > 0 ? 'text-red-600' : '';

    const browsers = [...new Set(run.environments.map((e) => e.browser))];
    const viewports = [...new Set(run.environments.map((e) => e.viewport).filter(Boolean))];

    const bugsBits = [
        run.bugs.high > 0 ? <span key="h" className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-red-700">HIGH {run.bugs.high}</span> : null,
        run.bugs.medium > 0 ? <span key="m" className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-amber-700">MED {run.bugs.medium}</span> : null,
        run.bugs.low > 0 ? <span key="l" className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-slate-700">LOW {run.bugs.low}</span> : null,
    ].filter(Boolean);

    const runDate = new Date(run.date);
    const formattedDate = runDate.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    return (
        <tr className="cursor-pointer transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none:bg-slate-800:bg-slate-800" tabIndex={0} role="link" aria-label={`Apri dettaglio run ${run.runId}`}>
            <td className="w-12 border-b border-slate-200 p-2.5 text-center align-middle" title={statusText} aria-label={statusText}>
                <span className="inline-flex items-center justify-center">
                    {statusIconSvg(statusKind as 'pass' | 'fail' | 'unknown')}
                </span>
            </td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">
                <Link href={`/reports/${run.runId}`} className="block font-semibold">
                    {formattedDate || run.runId}
                </Link>
                <span className={`block font-mono text-xs ${muted}`}>{run.runId}</span>
            </td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">
                <div className={`font-bold whitespace-nowrap ${outcomeClass}`}>
                    {run.total > 0 ? `${run.pass} /${run.total} con successo` : 'Nessun test'}
                </div>
                {run.total > 0 && (
                    <div className="mt-1.5 h-1.5 max-w-40 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${run.passRate}%` }} />
                    </div>
                )}
            </td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">
                {browsers.length ? (
                    <div className="flex flex-wrap gap-1.5">
                        {browsers.map((b) => (
                            <span key={b} className={chip}>{b}</span>
                        ))}
                    </div>
                ) : (
                    <span className={muted}>—</span>
                )}
            </td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">
                {viewports.length ? (
                    <div className="flex flex-wrap gap-1.5">
                        {viewports.map((v) => (
                            <span key={v} className={chip}>{v}</span>
                        ))}
                    </div>
                ) : (
                    <span className={muted}>—</span>
                )}
            </td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">{run.duration ? run.duration : <span className={muted}>—</span>}</td>
            <td className="border-b border-slate-200 px-3.5 py-2.5 align-middle">{bugsBits.length ? bugsBits : <span className={muted}>0</span>}</td>
        </tr>
    );
}
