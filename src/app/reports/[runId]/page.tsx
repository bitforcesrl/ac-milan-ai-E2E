import Link from 'next/link';
import { getRun } from '@/lib/azure-reports';
import { CheckCircle, XCircle, HelpCircle, Cpu, Clock, FileText } from '@deemlol/next-icons';
import PageHeader from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

const muted = 'text-dark-grey';
const chip = 'inline-flex items-center gap-1.5 rounded-full border border-grey bg-white px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap text-black';
const metaChip = 'inline-flex items-center gap-1.5 rounded-full border border-grey bg-white px-3 py-1 text-xs font-medium text-black';
const metaIcon = 'text-dark-grey';

function statusIcon(status: string) {
    const kind = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'unknown';
    const cls =
        kind === 'pass'
            ? 'text-green-600'
            : kind === 'fail'
                ? 'text-red-600'
                : 'text-dark-grey';
    return (
        <span className={`inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full ${cls}`}>
            {kind === 'pass' ? <CheckCircle size={30} aria-hidden="true" /> : kind === 'fail' ? <XCircle size={30} aria-hidden="true" /> : <HelpCircle size={18} aria-hidden="true" />}
        </span>
    );
}

function statusChip(status: string) {
    if (!status) return null;
    return status === 'PASS' ? (
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide bg-green-100 text-green-700" aria-label="Superato">PASS</span>
    ) : (
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide bg-red-100 text-red-700" aria-label="Fallito">FAIL</span>
    );
}

export default async function RunDetailPage({
    params,
}: {
    params: Promise<{ runId: string }>;
}) {
    const { runId } = await params;
    const run = await getRun(runId);

    if (!run) {
        return (
            <div className="min-h-screen bg-white text-black antialiased">
                <PageHeader
                    title={runId}
                    backLink={{ href: '/reports', label: 'Tutte le esecuzioni' }}
                />
                <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
                    <p className={`text-lg ${muted}`}>Run non trovata: {runId}</p>
                </main>
            </div>
        );
    }

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
        <div className="min-h-screen bg-white text-black antialiased">
            <PageHeader
                title={formattedDate || run.runId}
                backLink={{ href: '/reports', label: 'Tutte le esecuzioni' }}
            />

            <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
                <dl className="my-5 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 border-y border-grey py-4">
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Test Superati</dt><dd className="mt-0.5 text-xl font-bold text-green-600">{run.pass}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Test Falliti</dt><dd className={`mt-0.5 text-xl font-bold ${run.fail ? 'text-red-600' : ''}`}>{run.fail}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug HIGH</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.high ? 'text-red-600' : ''}`}>{run.bugs.high}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug MEDIUM</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.medium ? 'text-amber-600' : ''}`}>{run.bugs.medium}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug LOW</dt><dd className="mt-0.5 text-xl font-bold">{run.bugs.low}</dd></div>
                    {run.duration && <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Durata</dt><dd className="mt-0.5 text-xl font-bold">{run.duration}</dd></div>}
                    {run.cost > 0 && <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Costo</dt><dd className="mt-0.5 font-mono text-xl font-bold">${run.cost.toFixed(4)}</dd></div>}
                </dl>

                <h2 className="mb-4 mt-12 text-xl font-bold">Ambienti di test</h2>
                {run.sessions.length === 0 && <p className={muted}>Nessuna sessione disponibile per questo run.</p>}

                {run.sessions.map((session) => (
                    <section key={`${session.browser}/${session.viewport}`} className="mb-5 overflow-hidden rounded-xl border border-grey bg-white shadow-sm transition-shadow hover:shadow-md">
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-grey bg-grey/50 px-5 py-3.5">
                            <h3 className="flex flex-wrap items-center gap-2 text-base font-bold">
                                {session.browser}
                                {session.viewport && <span className={chip}>{session.viewport}</span>}
                                {session.model && (
                                    <span className={metaChip} title="Modello AI utilizzato">
                                        <Cpu size={13} className={metaIcon} aria-hidden="true" />
                                        {session.model}
                                    </span>
                                )}
                                {session.duration && (
                                    <span className={metaChip} title="Durata sessione">
                                        <Clock size={13} className={metaIcon} aria-hidden="true" />
                                        {session.duration}
                                    </span>
                                )}
                                {session.cost > 0 && (
                                    <span className={metaChip} title="Costo della sessione (USD)">
                                        ${session.cost.toFixed(4)}
                                    </span>
                                )}
                                {!session.model && !session.duration && (
                                    <span className={`text-xs italic ${muted}`}>Metadati non disponibili</span>
                                )}
                            </h3>
                            {statusIcon(session.status)}
                        </header>

                        <div className="p-5">
                            {session.summary && (
                                <div className="rounded-lg border border-grey bg-grey/40 p-4">
                                    <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-dark-grey">
                                        <FileText size={13} aria-hidden="true" />
                                        Summary sessione
                                    </h4>
                                    <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-black">{session.summary}</p>
                                </div>
                            )}

                            <h4 className={`mt-5 mb-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Dettaglio test</h4>
                            {session.tests.length ? (
                                <ul className="flex flex-col gap-2">
                                    {session.tests.map((test) => (
                                        <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-grey bg-grey px-3.5 py-2.5 transition-colors hover:border-dark-grey hover:bg-white">
                                            <span className="text-sm font-semibold break-all">{test.name}</span>
                                            <span className="flex shrink-0 items-center gap-2.5">
                                                {test.status ? statusChip(test.status) : <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${muted} bg-grey border border-grey`}>N/D</span>}
                                                {test.href && (
                                                    <Link className="text-sm font-bold uppercase tracking-wide whitespace-nowrap text-black hover:underline" href={test.href}>
                                                        Vai al dettaglio →
                                                    </Link>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={muted}>Nessun test registrato per questa sessione.</p>
                            )}
                        </div>
                    </section>
                ))}
            </main>
        </div>
    );
}
