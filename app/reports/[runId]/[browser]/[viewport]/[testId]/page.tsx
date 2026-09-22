import Link from 'next/link';
import { getTest, type BugEntry } from '@/lib/azure-reports';
import { CheckCircle, XCircle } from '@deemlol/next-icons';

export const dynamic = 'force-dynamic';

const SECTIONS = [
    { id: 'summary', label: 'Summary' },
    { id: 'steps', label: 'Passi del test' },
    { id: 'errors', label: 'Errori tecnici' },
    { id: 'bugs', label: 'Bug trovati' },
    { id: 'screenshots', label: 'Screenshot' },
];

const root = 'min-h-screen bg-slate-50 text-slate-900 antialiased';
const muted = 'text-slate-500';
const chip = 'inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap';
const section = 'mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

export default async function TestDetailPage({
    params,
}: {
    params: Promise<{ runId: string; browser: string; viewport: string; testId: string }>;
}) {
    const { runId, browser, viewport, testId } = await params;
    const detail = await getTest(runId, browser, viewport, testId);

    if (!detail) {
        return (
            <div className={root}>
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="pt-10">
                        <Link className="font-medium hover:underline" href={`/reports/${runId}`}>← Torna indietro</Link>
                    </aside>
                    <main className="min-w-0 max-w-3xl pt-10 pb-24">
                        <p className={`text-lg ${muted}`}>Report non trovato per il test: {testId}</p>
                    </main>
                </div>
            </div>
        );
    }

    const { report } = detail;
    const isPass = detail.status === 'PASS';
    const backHref = `/reports/${runId}`;
    const label = report.testName || report.test || testId;

    const metaBits = [
        report.browser && <p key="b" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Browser</span><b className="text-right font-mono text-xs font-semibold break-all">{report.browser}</b></p>,
        report.viewport && <p key="v" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Viewport</span><b className="text-right font-mono text-xs font-semibold break-all">{report.viewport}</b></p>,
        report.model && <p key="m" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Modello AI</span><b className="text-right font-mono text-xs font-semibold break-all">{report.model}</b></p>,
        report.duration && <p key="d" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Durata</span><b className="text-right font-mono text-xs font-semibold break-all">{report.duration}</b></p>,
    ].filter(Boolean);

    const hasBugs = (report.bugs ?? []).length > 0;
    const hasErrors = (report.errors ?? []).length > 0;
    const hasSteps = (report.steps ?? []).length > 0;
    const sections = SECTIONS.filter((s) =>
        s.id === 'summary' ? report.summary : s.id === 'steps' ? hasSteps : s.id === 'errors' ? hasErrors : s.id === 'bugs' ? hasBugs : detail.screenshots.length > 0,
    );

    return (
        <div className={root}>
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="self-start pt-10 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
                    <Link className="font-medium hover:underline" href={backHref}>← Torna indietro</Link>
                    <div className="my-6 border-b border-slate-200 pb-5">
                        <p className="m-0 text-xl font-semibold">{label}</p>
                        <p className={`mt-1 mb-0 text-sm ${muted}`}>{detail.runId}</p>
                        {detail.status && (
                            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${isPass ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {isPass ? <CheckCircle size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />} {isPass ? 'PASS' : 'FAIL'}
                            </p>
                        )}
                        {metaBits}
                    </div>
                    {sections.length > 0 && (
                        <nav aria-label="Sezioni del report">
                            <ol className="m-0 list-none p-0">
                                {sections.map((s) => (
                                    <li key={s.id}>
                                        <a href={`#${s.id}`} className="block py-1 pl-3 text-sm border-l-2 border-transparent hover:text-slate-900:text-slate-50">{s.label}</a>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}
                </aside>

                <main className="min-w-0 max-w-3xl pt-10 pb-24">
                    {detail.status && (
                        <p className={`mb-7 flex items-center gap-2.5 rounded-lg px-4 py-3.5 font-semibold border-l-4 ${isPass ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'}`}>
                            {isPass ? (
                                <><CheckCircle size={18} aria-hidden="true" /> Run superato con successo</>
                            ) : (
                                <><XCircle size={18} aria-hidden="true" /> Run fallito - Verificare gli errori</>
                            )}
                        </p>
                    )}

                    {report.summary && (
                        <section id="summary" className={section}>
                            <h2 className="mb-3 text-xl font-semibold">Summary</h2>
                            <p>{report.summary}</p>
                        </section>
                    )}

                    {hasSteps && (
                        <section id="steps" className={section}>
                            <h2 className="mb-3 text-xl font-semibold">Passi del test</h2>
                            {(report.steps ?? []).map((step, i) => {
                                const st = (step.status ?? '').toLowerCase();
                                const chipCls = st === 'pass'
                                    ? 'bg-green-100 text-green-700'
                                    : st === 'fail'
                                        ? 'bg-red-100 text-red-700'
                                        : `bg-slate-100 ${muted}`;
                                return (
                                    <div key={i} className="flex items-start gap-2.5 border-b border-slate-200 py-2 last:border-b-0">
                                        <span className={`inline-block shrink-0 rounded px-2 py-0.5 text-[0.65rem] font-bold tracking-wide ${chipCls}`}>
                                            {step.status || 'INFO'}
                                        </span>
                                        <div>
                                            <div className="text-sm font-semibold">{step.title}</div>
                                            {step.detail && <div className={`text-sm ${muted}`}>{step.detail}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {hasErrors && (
                        <section id="errors" className={section}>
                            <h2 className="mb-3 text-xl font-semibold">Errori tecnici</h2>
                            {(report.errors ?? []).map((err, i) => (
                                <div key={i} className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm">
                                    <div className="font-mono text-xs break-all">{err.message}</div>
                                    {err.context && <div className={`mt-1 text-xs ${muted}`}>{err.context}</div>}
                                </div>
                            ))}
                        </section>
                    )}

                    {hasBugs && (
                        <section id="bugs" className={section}>
                            <h2 className="mb-3 text-xl font-semibold">Bug trovati</h2>
                            {(report.bugs ?? []).map((bug, i) => (
                                <BugCard key={bug.id ?? i} bug={bug} />
                            ))}
                        </section>
                    )}

                    {detail.screenshots.length > 0 && (
                        <section id="screenshots" className={section}>
                            <h2 className="mb-3 text-xl font-semibold">Screenshot</h2>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                                {detail.screenshots.map((shot) => (
                                    <a key={shot.url} href={shot.url} target="_blank" rel="noopener noreferrer" title={shot.description} className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={shot.url} alt={shot.description || shot.name} loading="lazy" className="block h-30 w-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}

function BugCard({ bug }: { bug: BugEntry }) {
    const sev = (bug.severity ?? '').toUpperCase();
    const sevCls = sev === 'HIGH'
        ? 'bg-red-100 text-red-700'
        : sev === 'MEDIUM'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-700';
    return (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
                {bug.id && <span className={chip}>{bug.id}</span>}
                {sev && <span className={`inline-block rounded px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide ${sevCls}`}>{sev}</span>}
                {bug.title && <span className="text-sm font-bold">{bug.title}</span>}
            </div>
            <dl className="m-0 grid gap-1.5 text-sm">
                {bug.description && (
                    <div>
                        <dt className={`mt-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Descrizione</dt>
                        <dd className="mt-0.5 mb-0">{bug.description}</dd>
                    </div>
                )}
                {bug.stepsToReproduce && bug.stepsToReproduce.length > 0 && (
                    <div>
                        <dt className={`mt-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Steps to reproduce</dt>
                        <dd className="mt-0.5 mb-0">
                            <ol className="mt-1 mb-0 pl-5">
                                {bug.stepsToReproduce.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ol>
                        </dd>
                    </div>
                )}
                {bug.expected && (
                    <div>
                        <dt className={`mt-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Expected</dt>
                        <dd className="mt-0.5 mb-0">{bug.expected}</dd>
                    </div>
                )}
                {bug.actual && (
                    <div>
                        <dt className={`mt-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Actual</dt>
                        <dd className="mt-0.5 mb-0">{bug.actual}</dd>
                    </div>
                )}
                {bug.impact && (
                    <div>
                        <dt className={`mt-2 text-xs font-bold uppercase tracking-wide ${muted}`}>Impact</dt>
                        <dd className="mt-0.5 mb-0">{bug.impact}</dd>
                    </div>
                )}
            </dl>
        </div>
    );
}
