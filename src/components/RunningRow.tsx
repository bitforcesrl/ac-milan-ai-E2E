'use client';

import type { RunningBuild } from '@/lib/queries';
import { Cpu } from '@deemlol/next-icons';

/**
 * Riga della tabella reports che mostra una pipeline attualmente in corso (o in coda),
 * posizionata in cima alla lista delle run completate.
 */
export default function RunningRow({
  build,
  style,
}: {
  build: RunningBuild;
  style?: React.CSSProperties;
}) {
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
      className="group animate-fade-up from-primary/[0.03] via-primary/[0.07] to-primary/[0.03] bg-gradient-to-r"
    >
      <td className="border-grey w-12 border-b p-2.5 text-center align-middle">
        <span className="relative inline-flex h-3 w-3">
          <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
          <span className="bg-primary relative inline-flex h-3 w-3 rounded-full" />
        </span>
      </td>
      <td className="border-grey border-b px-3.5 py-2.5 align-middle">
        <span className="flex items-center gap-2 font-bold tracking-wide uppercase">
          <Cpu size={16} aria-hidden="true" className="text-primary shrink-0" />
          {startedAt ?? label}
        </span>
        <span className="text-dark-grey block font-mono text-xs">{build.buildNumber}</span>
      </td>
      <td className="border-grey border-b px-3.5 py-2.5 align-middle">
        <span className="text-dark-grey font-bold whitespace-nowrap">
          {queued ? 'In attesa di avvio…' : 'Gli agenti AI stanno lavorando…'}
        </span>
      </td>
      <td className="border-grey border-b px-3.5 py-2.5 align-middle">
        <span className="border-primary/20 text-primary inline-block rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap">
          {label}
        </span>
      </td>
      <td className="border-grey text-dark-grey border-b px-3.5 py-2.5 align-middle">—</td>
      <td className="border-grey border-b px-3.5 py-2.5 align-middle">
        {/* barra di avanzamento indeterminata */}
        <div className="bg-grey h-1.5 w-24 overflow-hidden rounded-full">
          <div className="bg-primary/60 animate-shimmer-slide h-full w-1/2 rounded-full" />
        </div>
      </td>
      <td className="border-grey text-dark-grey border-b px-3.5 py-2.5 align-middle">—</td>
      <td className="border-grey text-dark-grey border-b px-3.5 py-2.5 align-middle">0</td>
    </tr>
  );
}
