import PageHeader from '@/components/PageHeader';
import SessionMatrix from '@/components/SessionMatrix';
import SessionSummaryAccordion from '@/components/SessionSummaryAccordion';
import { getService } from '@/lib/services';

export const dynamic = 'force-dynamic';

const muted = 'text-dark-grey';

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await getService().getRun(runId);

  if (!run) {
    return (
      <div className="min-h-screen bg-white text-black antialiased">
        <PageHeader title={runId} backLink={{ href: '/reports', label: 'Tutte le esecuzioni' }} />
        <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
          <p className={`text-lg ${muted}`}>Run non trovata: {runId}</p>
        </main>
      </div>
    );
  }

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
    <div className="min-h-screen bg-white text-black antialiased">
      <PageHeader
        title={formattedDate || run.runId}
        backLink={{ href: '/reports', label: 'Tutte le esecuzioni' }}
      />

      <main className="mx-auto max-w-7xl px-6 pt-8 pb-24">
        {run.abortReason && (
          <p className="mb-2 rounded-lg border-l-4 border-orange-500 bg-orange-100 px-4 py-3.5 font-semibold text-orange-700">
            Run interrotta: {run.abortReason}
          </p>
        )}
        <dl className="border-grey my-5 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 border-y py-4">
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Test Superati</dt>
            <dd className="mt-0.5 text-xl font-bold text-green-600">{run.pass}</dd>
          </div>
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Test Falliti</dt>
            <dd className={`mt-0.5 text-xl font-bold ${run.fail ? 'text-red-600' : ''}`}>
              {run.fail}
            </dd>
          </div>
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Test in errore</dt>
            <dd className={`mt-0.5 text-xl font-bold ${run.error ? 'text-orange-600' : ''}`}>
              {run.error}
            </dd>
          </div>
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Bug HIGH</dt>
            <dd className={`mt-0.5 text-xl font-bold ${run.bugs.high ? 'text-red-600' : ''}`}>
              {run.bugs.high}
            </dd>
          </div>
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Bug MEDIUM</dt>
            <dd className={`mt-0.5 text-xl font-bold ${run.bugs.medium ? 'text-amber-600' : ''}`}>
              {run.bugs.medium}
            </dd>
          </div>
          <div>
            <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Bug LOW</dt>
            <dd className="mt-0.5 text-xl font-bold">{run.bugs.low}</dd>
          </div>
          {run.duration && (
            <div>
              <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Durata</dt>
              <dd className="mt-0.5 text-xl font-bold">{run.duration}</dd>
            </div>
          )}
          {run.cost > 0 && (
            <div>
              <dt className={`text-xs font-bold tracking-wide uppercase ${muted}`}>Costo</dt>
              <dd className="mt-0.5 font-mono text-xl font-bold">${run.cost.toFixed(4)}</dd>
            </div>
          )}
        </dl>

        <h2 className="mt-12 mb-4 text-xl font-bold">Matrice test × ambiente</h2>
        {run.sessions.length === 0 ? (
          <p className={muted}>Nessuna sessione disponibile per questo run.</p>
        ) : (
          <SessionMatrix run={run} />
        )}

        {run.sessions.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-xl font-bold">Analisi AI per ambiente</h2>
            <SessionSummaryAccordion sessions={run.sessions} />
          </>
        )}
      </main>
    </div>
  );
}
