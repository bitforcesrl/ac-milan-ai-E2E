'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, HelpCircle } from '@deemlol/next-icons';
import type { RunSummary } from '@/lib/azure-reports';

const muted = 'text-dark-grey';
const chip = 'inline-block rounded-full border border-grey bg-grey px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap text-black';

function statusIconSvg(kind: 'pass' | 'fail' | 'unknown') {
    if (kind === 'pass')
        return <CheckCircle size={22} aria-hidden="true" className="text-green-600" />;
    if (kind === 'fail')
        return <XCircle size={22} aria-hidden="true" className="text-primary" />;
    return <HelpCircle size={22} aria-hidden="true" className="text-dark-grey" />;
}

export default function RunRow({ run }: { run: RunSummary }) {
    const router = useRouter();
    const detailHref = `/reports/${run.runId}`;

    const navigate = () => router.push(detailHref);

    // La riga si comporta come un link: click ovunque e tastiera (Enter/Spazio).
    // Se il click proviene da un link interno (es. la data), lasciamo gestire a lui.
    function handleRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
        if ((event.target as HTMLElement).closest('a')) return;
        navigate();
    }

    function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate();
        }
    }

    const statusKind = run.status === 'PASS' ? 'pass' : run.status === 'FAIL' ? 'fail' : 'unknown';
    const statusText = run.status === 'PASS' ? 'Successo' : run.status === 'FAIL' ? 'Fallito' : 'Sconosciuto';
    const ok = run.total > 0 && run.fail === 0;
    const outcomeClass = ok ? 'text-green-600' : run.fail > 0 ? 'text-primary' : '';

    const browsers = [...new Set(run.environments.map((e) => e.browser))];
    const viewports = [...new Set(run.environments.map((e) => e.viewport).filter(Boolean))];

    const bugsBits = [
        run.bugs.high > 0 ? <span key="h" className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-primary">HIGH {run.bugs.high}</span> : null,
        run.bugs.medium > 0 ? <span key="m" className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-amber-700">MED {run.bugs.medium}</span> : null,
        run.bugs.low > 0 ? <span key="l" className="inline-block rounded-full bg-grey px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-dark-grey">LOW {run.bugs.low}</span> : null,
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
        <tr
            className="cursor-pointer transition-colors hover:bg-grey focus-visible:bg-grey focus-visible:outline-none"
            tabIndex={0}
            role="link"
            aria-label={`Apri dettaglio run ${run.runId}`}
            onClick={handleRowClick}
            onKeyDown={handleRowKeyDown}
        >
            <td className="w-12 border-b border-grey p-2.5 text-center align-middle" title={statusText} aria-label={statusText}>
                <span className="inline-flex items-center justify-center">
                    {statusIconSvg(statusKind as 'pass' | 'fail' | 'unknown')}
                </span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                <Link href={detailHref} className="block font-bold uppercase tracking-wide hover:text-primary">
                    {formattedDate || run.runId}
                </Link>
                <span className={`block font-mono text-xs ${muted}`}>{run.runId}</span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                <div className={`font-bold whitespace-nowrap ${outcomeClass}`}>
                    {run.total > 0 ? `${run.pass} /${run.total} con successo` : 'Nessun test'}
                </div>
                {run.total > 0 && (
                    <div className="mt-1.5 h-1.5 max-w-40 overflow-hidden rounded-full bg-grey">
                        <div className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${run.passRate}%` }} />
                    </div>
                )}
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
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
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
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
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">{run.duration ? run.duration : <span className={muted}>—</span>}</td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">{bugsBits.length ? bugsBits : <span className={muted}>0</span>}</td>
        </tr>
    );
}
