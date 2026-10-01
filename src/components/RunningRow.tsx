'use client';

import { Cpu } from '@deemlol/next-icons';

type RunningBuild = {
    id: number;
    buildNumber: string;
    status: string;
    queueTime?: string;
};

/**
 * Riga della tabella reports che mostra una pipeline attualmente in corso (o in coda),
 * posizionata in cima alla lista delle run completate.
 */
export default function RunningRow({ build, style }: { build: RunningBuild; style?: React.CSSProperties }) {
    const queued = build.status === 'notStarted';
    const label = queued ? 'In coda' : 'In corso';
    const startedAt = build.queueTime
        ? new Date(build.queueTime).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null;

    return (
        <tr
            style={style}
            className="group animate-fade-up bg-gradient-to-r from-primary/[0.03] via-primary/[0.07] to-primary/[0.03]"
        >
            <td className="w-12 border-b border-grey p-2.5 text-center align-middle">
                <span className="relative inline-flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                <span className="flex items-center gap-2 font-bold uppercase tracking-wide">
                    <Cpu size={16} aria-hidden="true" className="shrink-0 text-primary" />
                    {startedAt ?? label}
                </span>
                <span className="block font-mono text-xs text-dark-grey">{build.buildNumber}</span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                <span className="font-bold whitespace-nowrap text-dark-grey">
                    {queued ? 'In attesa di avvio…' : 'Gli agenti AI stanno lavorando…'}
                </span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                <span className="inline-block rounded-full border border-primary/20 px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap text-primary">
                    {label}
                </span>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle text-dark-grey">—</td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle">
                {/* barra di avanzamento indeterminata */}
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-grey">
                    <div className="h-full w-1/2 rounded-full bg-primary/60 animate-shimmer-slide" />
                </div>
            </td>
            <td className="border-b border-grey px-3.5 py-2.5 align-middle text-dark-grey">0</td>
        </tr>
    );
}
