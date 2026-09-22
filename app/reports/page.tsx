import Link from 'next/link';
import { listRuns, type RunSummary } from '@/lib/azure-reports';
import { iconSvg } from './ui';
import { RunDateTime } from './local-datetime';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
    let runs: RunSummary[] = [];
    let error: string | null = null;

    try {
        runs = await listRuns();
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    return (
        <div className="reports-root">
            <main className="index-page">
                <h1>Report E2E</h1>
                <p className="lede">
                    Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot
                </p>

                {error && (
                    <p className="lede">Errore di accesso ad Azure Blob: {error}</p>
                )}

                {!error && runs.length === 0 && <p className="lede">Nessuna esecuzione disponibile.</p>}

                {!error && runs.length > 0 && (
                    <div className="table-wrap runs-table-wrap">
                        <table className="runs-table">
                            <thead>
                                <tr>
                                    <th>Risultato</th>
                                    <th>Esecuzione</th>
                                    <th>Test superati</th>
                                    <th>Browser</th>
                                    <th>Viewport</th>
                                    <th>Durata</th>
                                    <th>Bug</th>
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
    const outcomeClass = run.total > 0 && run.fail === 0 ? 'ok' : run.fail > 0 ? 'ko' : '';

    const browsers = [...new Set(run.environments.map((e) => e.browser))];
    const viewports = [...new Set(run.environments.map((e) => e.viewport).filter(Boolean))];

    const bugsBits = [
        run.bugs.high > 0 ? <span key="h" className="bug-bit ko">HIGH {run.bugs.high}</span> : null,
        run.bugs.medium > 0 ? <span key="m" className="bug-bit warn">MED {run.bugs.medium}</span> : null,
        run.bugs.low > 0 ? <span key="l" className="bug-bit">LOW {run.bugs.low}</span> : null,
    ].filter(Boolean);

    return (
        <tr className="run-row" tabIndex={0} role="link" aria-label={`Apri dettaglio run ${run.runId}`}>
            <td className="status-cell">
                <span className={`status-icon ${statusKind}`} title={statusText} aria-label={statusText}>
                    {iconSvg(statusKind as 'pass' | 'fail' | 'unknown')}
                </span>
            </td>
            <td>
                <Link href={`/reports/${run.runId}`} className="run-cell-name">
                    <RunDateTime date={run.date} runId={run.runId} />
                </Link>
                <span className="run-cell-sub">{run.runId}</span>
            </td>
            <td>
                <div className={`outcome ${outcomeClass}`}>
                    {run.total > 0 ? `${run.pass} /${run.total} con successo` : 'Nessun test'}
                </div>
                {run.total > 0 && (
                    <div className="progress-bar">
                        <div className={`progress-fill ${outcomeClass}`} style={{ width: `${run.passRate}%` }} />
                    </div>
                )}
            </td>
            <td>
                {browsers.length ? (
                    <div className="env-chips">
                        {browsers.map((b) => (
                            <span key={b} className="env-chip">{b}</span>
                        ))}
                    </div>
                ) : (
                    <span className="muted">—</span>
                )}
            </td>
            <td>
                {viewports.length ? (
                    <div className="env-chips">
                        {viewports.map((v) => (
                            <span key={v} className="env-chip">{v}</span>
                        ))}
                    </div>
                ) : (
                    <span className="muted">—</span>
                )}
            </td>
            <td>{run.duration ? run.duration : <span className="muted">—</span>}</td>
            <td>{bugsBits.length ? bugsBits : <span className="muted">0</span>}</td>
        </tr>
    );
}
