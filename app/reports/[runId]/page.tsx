import Link from 'next/link';
import { getRun } from '@/lib/azure-reports';
import { statusChip, statusIcon } from '../ui';
import { RunDateTime } from '../local-datetime';

export const dynamic = 'force-dynamic';

export default async function RunDetailPage({
    params,
}: {
    params: Promise<{ runId: string }>;
}) {
    const { runId } = await params;
    const run = await getRun(runId);

    if (!run) {
        return (
            <div className="reports-root">
                <main className="index-page detail-page">
                    <Link className="back" href="/reports">← Tutte le esecuzioni</Link>
                    <p className="lede">Run non trovata: {runId}</p>
                </main>
            </div>
        );
    }

    return (
        <div className="reports-root">
            <main className="index-page detail-page">
                <Link className="back" href="/reports">← Tutte le esecuzioni</Link>
                <h1><RunDateTime date={run.date} runId={run.runId} /></h1>
                <p className="lede">{run.runId}</p>

                <dl className="run-stats">
                    <div className="stat"><dt>Test Superati</dt><dd className="ok">{run.pass}</dd></div>
                    <div className="stat"><dt>Test Falliti</dt><dd className={run.fail ? 'ko' : ''}>{run.fail}</dd></div>
                    <div className="stat"><dt>Bug HIGH</dt><dd className={run.bugs.high ? 'ko' : ''}>{run.bugs.high}</dd></div>
                    <div className="stat"><dt>Bug MEDIUM</dt><dd className={run.bugs.medium ? 'warn' : ''}>{run.bugs.medium}</dd></div>
                    <div className="stat"><dt>Bug LOW</dt><dd>{run.bugs.low}</dd></div>
                    {run.duration && <div className="stat"><dt>Durata</dt><dd>{run.duration}</dd></div>}
                </dl>

                <h2>Ambienti di test</h2>
                {run.sessions.length === 0 && <p className="muted">Nessuna sessione disponibile per questo run.</p>}

                {run.sessions.map((session) => (
                    <section key={`${session.browser}/${session.viewport}`} className="detail-session">
                        <header className="detail-session-head">
                            <h3>
                                {session.browser}
                                {session.viewport && <span className="env-chip">{session.viewport}</span>}
                            </h3>
                            {statusIcon(session.status)}
                        </header>
                        <p className="detail-meta">
                            {[session.model && `Modello AI: ${session.model}`, session.duration && `Durata: ${session.duration}`]
                                .filter(Boolean)
                                .join(' · ') || <span className="muted">Metadati non disponibili</span>}
                        </p>

                        {session.summary && (
                            <details open>
                                <summary className="cursor-pointer text-sm font-medium text-neutral-700 mt-3">
                                    Summary sessione
                                </summary>
                                <pre className="whitespace-pre-wrap text-sm mt-2 mb-0">{session.summary}</pre>
                            </details>
                        )}

                        <h4>Dettaglio test</h4>
                        {session.tests.length ? (
                            <ul className="detail-tests">
                                {session.tests.map((test) => (
                                    <li key={test.id} className="detail-test-row">
                                        <span className="detail-test-name">{test.name}</span>
                                        <span className="detail-test-actions">
                                            {test.status ? statusChip(test.status) : <span className="chip unknown">N/D</span>}
                                            {test.href && (
                                                <Link className="test-detail-link" href={test.href}>
                                                    Vai al dettaglio →
                                                </Link>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="muted">Nessun test registrato per questa sessione.</p>
                        )}

                        <h4>Screenshot</h4>
                        {session.screenshots.length ? (
                            <div className="detail-shots">
                                {session.screenshots.map((shot) => (
                                    <a key={shot.url} href={shot.url} target="_blank" rel="noopener noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={shot.url} alt={shot.name} loading="lazy" />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="muted">Nessuno screenshot disponibile.</p>
                        )}
                    </section>
                ))}
            </main>
        </div>
    );
}
