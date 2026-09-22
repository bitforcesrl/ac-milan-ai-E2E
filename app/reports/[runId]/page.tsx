import Link from 'next/link';
import { getRun } from '@/lib/azure-reports';
import { ArrowLeft, CheckCircle, XCircle, HelpCircle } from '@deemlol/next-icons';

export const dynamic = 'force-dynamic';

const muted = 'text-dark-grey';
const chip = 'inline-block rounded-full border border-grey bg-grey px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap text-black';

function statusIcon(status: string) {
    const kind = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'unknown';
    const cls =
        kind === 'pass'
            ? 'text-green-600'
            : kind === 'fail'
                ? 'text-primary'
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
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide bg-primary/10 text-primary" aria-label="Fallito">FAIL</span>
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
                <main className="mx-auto max-w-7xl px-6 pt-10 pb-24">
                    <Link className="mb-6 inline-flex items-center gap-1.5 font-medium text-dark-grey hover:text-primary hover:underline" href="/reports"><ArrowLeft size={16} aria-hidden="true" /> Tutte le esecuzioni</Link>
                    <p className={`text-lg ${muted}`}>Run non trovata: {runId}</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-black antialiased">
            <header className="bg-black text-white">
                <main className="mx-auto max-w-7xl px-6 py-8">
                    <Link className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white" href="/reports"><ArrowLeft size={16} aria-hidden="true" /> Tutte le esecuzioni</Link>
                    <h1 className="store-heading mb-4 text-2xl sm:text-3xl">{run.date || run.runId}</h1>
                    <p className="font-mono text-sm text-white">{run.runId}</p>
                </main>
            </header>

            <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
                <dl className="my-5 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 border-y border-grey py-4">
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Test Superati</dt><dd className="mt-0.5 text-xl font-bold text-green-600">{run.pass}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Test Falliti</dt><dd className={`mt-0.5 text-xl font-bold ${run.fail ? 'text-primary' : ''}`}>{run.fail}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug HIGH</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.high ? 'text-primary' : ''}`}>{run.bugs.high}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug MEDIUM</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.medium ? 'text-amber-600' : ''}`}>{run.bugs.medium}</dd></div>
                    <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Bug LOW</dt><dd className="mt-0.5 text-xl font-bold">{run.bugs.low}</dd></div>
                    {run.duration && <div><dt className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Durata</dt><dd className="mt-0.5 text-xl font-bold">{run.duration}</dd></div>}
                </dl>

                <h2 className="store-heading mb-4 mt-12 text-xl">Ambienti di test</h2>
                {run.sessions.length === 0 && <p className={muted}>Nessuna sessione disponibile per questo run.</p>}

                {run.sessions.map((session) => (
                    <section key={`${session.browser}/${session.viewport}`} className="mb-5 rounded-xl border border-grey bg-white p-5 shadow-sm">
                        <header className="flex items-center justify-between gap-3 border-b border-grey pb-3">
                            <h3 className="store-heading flex flex-wrap items-center gap-2 text-base">
                                {session.browser}
                                {session.viewport && <span className={chip}>{session.viewport}</span>}
                            </h3>
                            {statusIcon(session.status)}
                        </header>
                        <p className={`mt-3 text-sm ${muted}`}>
                            {[session.model && `Modello AI: ${session.model}`, session.duration && `Durata: ${session.duration}`]
                                .filter(Boolean)
                                .join(' · ') || <span className={muted}>Metadati non disponibili</span>}
                        </p>

                        {session.summary && (
                            <div className="mt-4">
                                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-dark-grey">Summary sessione</h4>
                                <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-black">{session.summary}</p>
                            </div>
                        )}

                        <h4 className={`mt-5 mb-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Dettaglio test</h4>
                        {session.tests.length ? (
                            <ul className="flex flex-col gap-2">
                                {session.tests.map((test) => (
                                    <li key={test.id} className="flex items-center justify-between gap-3 rounded-lg border border-grey bg-grey px-3.5 py-2.5 transition-colors hover:border-primary/40">
                                        <span className="text-sm font-semibold break-all">{test.name}</span>
                                        <span className="flex shrink-0 items-center gap-2.5">
                                            {test.status ? statusChip(test.status) : <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${muted} bg-grey border border-grey`}>N/D</span>}
                                            {test.href && (
                                                <Link className="text-sm font-bold uppercase tracking-wide whitespace-nowrap text-primary hover:underline" href={test.href}>
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

                        <h4 className={`mt-5 mb-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Screenshot</h4>
                        {session.screenshots.length ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                                {session.screenshots.map((shot) => (
                                    <a key={shot.url} href={shot.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-grey bg-grey transition-shadow hover:shadow-md">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={shot.url} alt={shot.name} loading="lazy" className="block h-30 w-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className={muted}>Nessuno screenshot disponibile.</p>
                        )}
                    </section>
                ))}
            </main>
        </div>
    );
}
