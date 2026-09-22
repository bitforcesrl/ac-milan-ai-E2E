import Link from 'next/link';
import { getRun } from '@/lib/azure-reports';
import { CheckCircle, XCircle, HelpCircle } from '@deemlol/next-icons';

export const dynamic = 'force-dynamic';

const root = 'min-h-screen bg-slate-50 text-slate-900 antialiased';
const muted = 'text-slate-500';
const chip = 'inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap';

function statusIcon(status: string) {
    const kind = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'unknown';
    const cls =
        kind === 'pass'
            ? 'text-green-600'
            : kind === 'fail'
                ? 'text-red-600'
                : 'text-slate-400';
    return (
        <span className={`inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full ${cls}`}>
            {kind === 'pass' ? <CheckCircle size={30} aria-hidden="true" /> : kind === 'fail' ? <XCircle size={30} aria-hidden="true" /> : <HelpCircle size={18} aria-hidden="true" />}
        </span>
    );
}

function statusChip(status: string) {
    if (!status) return null;
    return status === 'PASS' ? (
        <span className="inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold tracking-wide bg-green-100 text-green-700" aria-label="Superato">PASS</span>
    ) : (
        <span className="inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold tracking-wide bg-red-100 text-red-700" aria-label="Fallito">FAIL</span>
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
            <div className={root}>
                <main className="mx-auto max-w-7xl px-6 pt-10 pb-24">
                    <Link className="mb-6 inline-block font-medium hover:underline" href="/reports">← Tutte le esecuzioni</Link>
                    <p className={`text-lg ${muted}`}>Run non trovata: {runId}</p>
                </main>
            </div>
        );
    }

    return (
        <div className={root}>
            <main className="mx-auto max-w-7xl px-6 pt-10 pb-24">
                <Link className="mb-6 inline-block font-medium hover:underline" href="/reports">← Tutte le esecuzioni</Link>
                <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">{run.date || run.runId}</h1>
                <p className={`mb-8 text-lg ${muted}`}>{run.runId}</p>

                <dl className="my-5 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 border-y border-slate-200 py-4">
                    <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Test Superati</dt><dd className="mt-0.5 text-xl font-bold text-green-600">{run.pass}</dd></div>
                    <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Test Falliti</dt><dd className={`mt-0.5 text-xl font-bold ${run.fail ? 'text-red-600' : ''}`}>{run.fail}</dd></div>
                    <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Bug HIGH</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.high ? 'text-red-600' : ''}`}>{run.bugs.high}</dd></div>
                    <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Bug MEDIUM</dt><dd className={`mt-0.5 text-xl font-bold ${run.bugs.medium ? 'text-amber-600' : ''}`}>{run.bugs.medium}</dd></div>
                    <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Bug LOW</dt><dd className="mt-0.5 text-xl font-bold">{run.bugs.low}</dd></div>
                    {run.duration && <div><dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Durata</dt><dd className="mt-0.5 text-xl font-bold">{run.duration}</dd></div>}
                </dl>

                <h2 className="mb-4 mt-12 text-2xl font-semibold">Ambienti di test</h2>
                {run.sessions.length === 0 && <p className={muted}>Nessuna sessione disponibile per questo run.</p>}

                {run.sessions.map((session) => (
                    <section key={`${session.browser}/${session.viewport}`} className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <header className="flex items-center justify-between gap-3">
                            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                                {session.browser}
                                {session.viewport && <span className={chip}>{session.viewport}</span>}
                            </h3>
                            {statusIcon(session.status)}
                        </header>
                        <p className={`mt-1 text-sm ${muted}`}>
                            {[session.model && `Modello AI: ${session.model}`, session.duration && `Durata: ${session.duration}`]
                                .filter(Boolean)
                                .join(' · ') || <span className={muted}>Metadati non disponibili</span>}
                        </p>

                        {session.summary && (
                            <details open>
                                <summary className="mt-3 cursor-pointer text-sm font-medium">Summary sessione</summary>
                                <pre className="mt-2 mb-0 whitespace-pre-wrap text-sm">{session.summary}</pre>
                            </details>
                        )}

                        <h4 className={`mt-4 mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>Dettaglio test</h4>
                        {session.tests.length ? (
                            <ul className="flex flex-col gap-2">
                                {session.tests.map((test) => (
                                    <li key={test.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                                        <span className="text-sm font-semibold break-all">{test.name}</span>
                                        <span className="flex shrink-0 items-center gap-2.5">
                                            {test.status ? statusChip(test.status) : <span className={`inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold tracking-wide ${muted} bg-slate-100`}>N/D</span>}
                                            {test.href && (
                                                <Link className="text-sm font-semibold whitespace-nowrap hover:underline" href={test.href}>
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

                        <h4 className={`mt-4 mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>Screenshot</h4>
                        {session.screenshots.length ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                                {session.screenshots.map((shot) => (
                                    <a key={shot.url} href={shot.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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
