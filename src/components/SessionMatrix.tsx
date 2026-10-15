import { browserLabel, viewportLabel } from '@/lib/e2e-tests';
import type { RunDetail, SessionView } from '@/types/reports';
import Link from 'next/link';

const muted = 'text-dark-grey';

type Cell = { test: SessionView['tests'][number] | null; session: SessionView };

function passChip(href?: string) {
  const chip = (
    <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-green-700">
      PASS
    </span>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80" aria-label="Vai al dettaglio del test">
      {chip}
    </Link>
  ) : (
    chip
  );
}

function failChip(href?: string) {
  const chip = (
    <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-red-700">
      FAIL
    </span>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80" aria-label="Vai al dettaglio del test">
      {chip}
    </Link>
  ) : (
    chip
  );
}

function ndChip() {
  return (
    <span
      className={`inline-block rounded-full bg-grey border border-grey px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${muted}`}
    >
      N/D
    </span>
  );
}

/**
 * Matrice test × ambiente: righe = test, colonne = sessioni (browser × viewport).
 * Le colonne sono raggruppate per browser nell'ordine di apparizione nelle sessioni.
 */
export default function SessionMatrix({ run }: { run: RunDetail }) {
  const sessions = run.sessions;

  // Colonne: una per sessione, raggruppate per browser (ordine di apparizione).
  const browserOrder: string[] = [];
  for (const s of sessions) {
    if (!browserOrder.includes(s.browser)) browserOrder.push(s.browser);
  }
  const columns = sessions.map((session) => ({
    session,
    key: `${session.browser}/${session.viewport}`,
  }));

  // Righe: test unici per id, nell'ordine di apparizione; i FAIL prima.
  const rowIds: string[] = [];
  const rowNames = new Map<string, string>();
  const cells = new Map<string, Cell>(); // key: testId|browser/viewport
  for (const session of sessions) {
    for (const test of session.tests) {
      if (!rowIds.includes(test.id)) rowIds.push(test.id);
      if (!rowNames.has(test.id)) rowNames.set(test.id, test.name);
      cells.set(`${test.id}|${session.browser}/${session.viewport}`, { test, session });
    }
  }
  const sortedRowIds = [...rowIds].sort((a, b) => {
    const aFail = sessions.some(
      (s) => s.tests.find((t) => t.id === a)?.status === 'FAIL',
    );
    const bFail = sessions.some(
      (s) => s.tests.find((t) => t.id === b)?.status === 'FAIL',
    );
    if (aFail !== bFail) return aFail ? -1 : 1;
    return rowIds.indexOf(a) - rowIds.indexOf(b);
  });

  if (sessions.length === 0 || sortedRowIds.length === 0) return null;

  return (
    <div className="border-grey overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          {/* Riga 1: browser (colspan sui viewport) */}
          <tr className="border-grey bg-grey/50 border-b">
            <th
              scope="col"
              className={`border-grey border-r px-4 py-3 text-xs font-bold tracking-wide uppercase ${muted}`}
              rowSpan={2}
            >
              Test
            </th>
            {browserOrder.map((browser) => {
              const count = columns.filter((c) => c.session.browser === browser).length;
              return (
                <th
                  key={browser}
                  scope="colgroup"
                  colSpan={count}
                  className="border-grey border-r px-4 py-3 text-center text-sm font-bold last:border-r-0"
                >
                  {browserLabel(browser)}
                </th>
              );
            })}
          </tr>
          {/* Riga 2: viewport */}
          <tr className="border-grey bg-grey/30 border-b">
            {columns.map(({ session, key }) => (
              <th
                key={key}
                scope="col"
                className="border-grey border-r px-3 py-2 text-center text-xs font-semibold whitespace-nowrap last:border-r-0"
              >
                {session.viewport ? viewportLabel(session.viewport) : '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRowIds.map((testId) => (
            <tr key={testId} className="border-grey border-b last:border-b-0">
              <th
                scope="row"
                className="border-grey border-r min-w-[220px] px-4 py-3 text-sm font-semibold whitespace-nowrap"
              >
                {rowNames.get(testId)}
              </th>
              {columns.map(({ session, key }) => {
                const cell = cells.get(`${testId}|${key}`);
                if (!cell) {
                  return (
                    <td key={key} className="border-grey border-r px-3 py-3 text-center last:border-r-0">
                      {ndChip()}
                    </td>
                  );
                }
                const { test } = cell;
                if (!test) {
                  return (
                    <td key={key} className="border-grey border-r px-3 py-3 text-center last:border-r-0">
                      {ndChip()}
                    </td>
                  );
                }
                return (
                  <td key={key} className="border-grey border-r px-3 py-3 text-center last:border-r-0">
                    {test.status === 'PASS'
                      ? passChip(test.href)
                      : test.status === 'FAIL'
                        ? failChip(test.href)
                        : ndChip()}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
