import StatusChip from '@/components/StatusChip';
import { browserLabel, viewportLabel } from '@/lib/e2e-tests';
import type { SessionView } from '@/types/reports';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  FileText,
  HelpCircle,
  XCircle,
} from '@deemlol/next-icons';
import Link from 'next/link';

const muted = 'text-dark-grey';
const metaChip =
  'inline-flex items-center gap-1.5 rounded-full border border-grey bg-white px-3 py-1 text-xs font-medium text-black';
const metaIcon = 'text-dark-grey';

function statusIcon(status: string) {
  const kind =
    status === 'PASS'
      ? 'pass'
      : status === 'FAIL'
        ? 'fail'
        : status === 'ERROR'
          ? 'error'
          : 'unknown';
  const cls =
    kind === 'pass'
      ? 'text-green-600'
      : kind === 'fail'
        ? 'text-red-600'
        : kind === 'error'
          ? 'text-orange-600'
          : 'text-dark-grey';
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`}
    >
      {kind === 'pass' ? (
        <CheckCircle size={26} aria-hidden="true" />
      ) : kind === 'fail' ? (
        <XCircle size={26} aria-hidden="true" />
      ) : kind === 'error' ? (
        <AlertTriangle size={24} aria-hidden="true" />
      ) : (
        <HelpCircle size={16} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Accordion "Analisi AI per ambiente": un <details> per sessione (browser × viewport).
 * Le sessioni FAIL/ERROR sono aperte di default, le PASS chiuse. Nessun JS client.
 */
export default function SessionSummaryAccordion({ sessions }: { sessions: SessionView[] }) {
  if (sessions.length === 0) return null;

  // FAIL/ERROR prima, poi nell'ordine originale.
  const notPassed = (s: SessionView) => s.status === 'FAIL' || s.status === 'ERROR';
  const sorted = [...sessions].sort((a, b) => {
    const aFail = notPassed(a) ? 0 : 1;
    const bFail = notPassed(b) ? 0 : 1;
    return aFail - bFail;
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((session) => {
        const open = notPassed(session);
        const key = `${session.browser}/${session.viewport}`;
        return (
          <details
            key={key}
            open={open}
            className="border-grey group overflow-hidden rounded-xl border bg-white shadow-sm open:shadow-md"
          >
            <summary className="border-grey bg-grey/50 hover:bg-grey/70 flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3.5 select-none [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {statusIcon(session.status)}
                {session.viewport ? (
                  <>
                    {browserLabel(session.browser)}
                    <span className={`font-normal ${muted}`} aria-hidden="true">
                      ·
                    </span>
                    <span className="font-semibold">{viewportLabel(session.viewport)}</span>
                  </>
                ) : (
                  browserLabel(session.browser)
                )}
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
              </span>
              <span
                className={`text-xs font-bold tracking-wide uppercase ${muted} transition-transform group-open:rotate-90`}
                aria-hidden="true"
              >
                ▸
              </span>
            </summary>

            <div className="p-5">
              {session.summary && (
                <div className="border-grey bg-grey/40 rounded-lg border p-4">
                  <h4 className="text-dark-grey mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                    <FileText size={13} aria-hidden="true" />
                    Summary sessione
                  </h4>
                  <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-black">
                    {session.summary}
                  </p>
                </div>
              )}
              {session.tests.length > 0 && (
                <div className="mt-4">
                  <h4 className={`mb-2 text-xs font-bold tracking-wide uppercase ${muted}`}>
                    Dettaglio test
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {session.tests.map((test) => (
                      <li
                        key={test.id}
                        className="border-grey bg-grey hover:border-dark-grey flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold break-all">{test.name}</span>
                          {test.reason && (
                            <span
                              title={test.reason}
                              className={`mt-0.5 line-clamp-2 text-xs break-all ${test.status === 'ERROR' ? 'text-orange-700' : muted}`}
                            >
                              {test.errorType && (
                                <code className="mr-1 font-mono">{test.errorType}</code>
                              )}
                              {test.reason}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          {test.duration && (
                            <span
                              className="border-grey inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 font-mono text-[0.72rem] font-medium whitespace-nowrap text-black"
                              title="Durata del test"
                            >
                              <Clock size={12} className={metaIcon} aria-hidden="true" />
                              {test.duration}
                            </span>
                          )}
                          <StatusChip status={test.status} />
                          {test.href && (
                            <Link
                              className="text-sm font-bold tracking-wide whitespace-nowrap text-black uppercase hover:underline"
                              href={test.href}
                            >
                              Vai al dettaglio →
                            </Link>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
