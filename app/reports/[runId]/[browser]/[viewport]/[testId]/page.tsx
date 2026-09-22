import Link from 'next/link';
import { getTest, type BugEntry } from '@/lib/azure-reports';
import { iconSvg } from '../../../../ui';

export const dynamic = 'force-dynamic';

const SECTIONS = [
    { id: 'summary', label: 'Summary' },
    { id: 'steps', label: 'Passi del test' },
    { id: 'errors', label: 'Errori tecnici' },
    { id: 'bugs', label: 'Bug trovati' },
    { id: 'screenshots', label: 'Screenshot' },
];

export default async function TestDetailPage({
    params,
}: {
    params: Promise<{ runId: string; browser: string; viewport: string; testId: string }>;
}) {
    const { runId, browser, viewport, testId } = await params;
    const detail = await getTest(runId, browser, viewport, testId);

    if (!detail) {
        return (
            <div className="reports-root">
                <div className="shell">
                    <aside className="rail">
                        <Link className="back" href={`/reports/${runId}`}>← Torna indietro</Link>
                    </aside>
                    <main className="doc">
                        <p className="lede">Report non trovato per il test: {testId}</p>
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
        report.browser && <p key="b" className="meta-bit"><span>Browser</span><b>{report.browser}</b></p>,
        report.viewport && <p key="v" className="meta-bit"><span>Viewport</span><b>{report.viewport}</b></p>,
        report.model && <p key="m" className="meta-bit"><span>Modello AI</span><b>{report.model}</b></p>,
        report.duration && <p key="d" className="meta-bit"><span>Durata</span><b>{report.duration}</b></p>,
    ].filter(Boolean);

    const hasBugs = (report.bugs ?? []).length > 0;
    const hasErrors = (report.errors ?? []).length > 0;
    const hasSteps = (report.steps ?? []).length > 0;
    const sections = SECTIONS.filter((s) =>
        s.id === 'summary' ? report.summary : s.id === 'steps' ? hasSteps : s.id === 'errors' ? hasErrors : s.id === 'bugs' ? hasBugs : detail.screenshots.length > 0,
    );

    return (
        <div className="reports-root">
            <div className="shell">
                <aside className="rail">
                    <Link className="back" href={backHref}>← Torna indietro</Link>
                    <div className="run">
                        <p className="run-name">{label}</p>
                        <p className="run-date">{detail.runId}</p>
                        {detail.status && (
                            <p className={`status-badge ${isPass ? 'pass' : 'fail'}`}>
                                {iconSvg(isPass ? 'pass' : 'fail')} {isPass ? 'PASS' : 'FAIL'}
                            </p>
                        )}
                        {metaBits}
                    </div>
                    {sections.length > 0 && (
                        <nav className="toc" aria-label="Sezioni del report">
                            <ol>
                                {sections.map((s) => (
                                    <li key={s.id}>
                                        <a href={`#${s.id}`}>{s.label}</a>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}
                </aside>

                <main className="doc">
                    {detail.status && (
                        <p className={`status-banner ${isPass ? 'pass' : 'fail'}`}>
                            {isPass ? (
                                <>{iconSvg('pass')} Run superato con successo</>
                            ) : (
                                <>{iconSvg('fail')} Run fallito - Verificare gli errori</>
                            )}
                        </p>
                    )}

                    {report.summary && (
                        <section id="summary" className="report-section">
                            <h2>Summary</h2>
                            <p>{report.summary}</p>
                        </section>
                    )}

                    {hasSteps && (
                        <section id="steps" className="report-section">
                            <h2>Passi del test</h2>
                            {(report.steps ?? []).map((step, i) => (
                                <div key={i} className="step-row">
                                    <span className={`chip ${(step.status ?? '').toLowerCase() === 'pass' ? 'pass' : (step.status ?? '').toLowerCase() === 'fail' ? 'fail' : 'unknown'}`}>
                                        {step.status || 'INFO'}
                                    </span>
                                    <div>
                                        <div className="step-title">{step.title}</div>
                                        {step.detail && <div className="step-detail">{step.detail}</div>}
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {hasErrors && (
                        <section id="errors" className="report-section">
                            <h2>Errori tecnici</h2>
                            {(report.errors ?? []).map((err, i) => (
                                <div key={i} className="error-row">
                                    <div className="err-msg">{err.message}</div>
                                    {err.context && <div className="err-ctx">{err.context}</div>}
                                </div>
                            ))}
                        </section>
                    )}

                    {hasBugs && (
                        <section id="bugs" className="report-section">
                            <h2>Bug trovati</h2>
                            {(report.bugs ?? []).map((bug, i) => (
                                <BugCard key={bug.id ?? i} bug={bug} />
                            ))}
                        </section>
                    )}

                    {detail.screenshots.length > 0 && (
                        <section id="screenshots" className="report-section">
                            <h2>Screenshot</h2>
                            <div className="detail-shots">
                                {detail.screenshots.map((shot) => (
                                    <a key={shot.url} href={shot.url} target="_blank" rel="noopener noreferrer" title={shot.description}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={shot.url} alt={shot.description || shot.name} loading="lazy" />
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
    const sevClass = sev === 'HIGH' ? 'ko' : sev === 'MEDIUM' ? 'warn' : '';
    return (
        <div className="bug-card">
            <div className="bug-head">
                {bug.id && <span className="env-chip">{bug.id}</span>}
                {sev && <span className={`bug-bit ${sevClass}`}>{sev}</span>}
                {bug.title && <span className="bug-title">{bug.title}</span>}
            </div>
            <dl>
                {bug.description && (
                    <div>
                        <dt>Descrizione</dt>
                        <dd>{bug.description}</dd>
                    </div>
                )}
                {bug.stepsToReproduce && bug.stepsToReproduce.length > 0 && (
                    <div>
                        <dt>Steps to reproduce</dt>
                        <dd>
                            <ol>
                                {bug.stepsToReproduce.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ol>
                        </dd>
                    </div>
                )}
                {bug.expected && (
                    <div>
                        <dt>Expected</dt>
                        <dd>{bug.expected}</dd>
                    </div>
                )}
                {bug.actual && (
                    <div>
                        <dt>Actual</dt>
                        <dd>{bug.actual}</dd>
                    </div>
                )}
                {bug.impact && (
                    <div>
                        <dt>Impact</dt>
                        <dd>{bug.impact}</dd>
                    </div>
                )}
            </dl>
        </div>
    );
}
