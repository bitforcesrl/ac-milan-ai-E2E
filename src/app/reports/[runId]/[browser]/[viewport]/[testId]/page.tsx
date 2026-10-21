import PageHeader from '@/components/PageHeader';
import ReportMarkdown from '@/components/ReportMarkdown';
import { browserLabel, viewportLabel } from '@/lib/e2e-tests';
import { getService } from '@/lib/services';
import { AlertTriangle, ArrowUpRight, CheckCircle, XCircle } from '@deemlol/next-icons';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const dynamic = 'force-dynamic';

const root = 'min-h-screen bg-white text-black antialiased';
const muted = 'text-dark-grey';

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ runId: string; browser: string; viewport: string; testId: string }>;
}) {
  const { runId, browser, viewport, testId } = await params;
  const detail = await getService().getTest(runId, browser, viewport, testId);

  if (!detail) {
    return (
      <div className={root}>
        <PageHeader
          title={testId}
          backLink={{ href: `/reports/${runId}`, label: 'Torna indietro' }}
        />
        <main className="mx-auto w-full max-w-7xl px-6 pt-8 pb-24">
          <p className={`text-lg ${muted}`}>Report non trovato per il test: {testId}</p>
        </main>
      </div>
    );
  }

  const isPass = detail.status === 'PASS';
  const isError = detail.status === 'ERROR';
  const backHref = `/reports/${runId}`;
  // Stili e testi per esito: ERROR (test non giunto a esito) distinto da FAIL
  const chipClass = isPass
    ? 'bg-green-100 text-green-600'
    : isError
      ? 'bg-orange-100 text-orange-700'
      : 'bg-red-100 text-red-700';
  const bannerClass = isPass
    ? 'border-green-500 bg-green-100 text-green-700'
    : isError
      ? 'border-orange-500 bg-orange-100 text-orange-700'
      : 'border-red-500 bg-red-100 text-red-700';
  const statusIcon = isPass ? (
    <CheckCircle size={18} aria-hidden="true" />
  ) : isError ? (
    <AlertTriangle size={18} aria-hidden="true" />
  ) : (
    <XCircle size={18} aria-hidden="true" />
  );
  const bannerText = isPass
    ? 'Test superato con successo'
    : isError
      ? 'Test non giunto a esito - Verificare il motivo e il log della sessione'
      : 'Test fallito - Verificare gli errori';

  // I report linkano gli screenshot con percorso relativo (../screenshots/<file>.png):
  // li riscriviamo con gli URL SAS dei blob cosi' le immagini si vedono nella pagina.
  const shotsByName = new Map(detail.screenshots.map((s) => [s.name, s.url]));
  const html = sanitizeHtml(
    await marked.parse(
      detail.report.replace(/\]\((?:\.\.\/)*screenshots\/([^)\s]+)\)/g, (match, name) => {
        const url = shotsByName.get(name);
        return url ? `](${url})` : match;
      }),
    ),
    // Consentiti: tag Markdown standard + immagini (screenshot con URL SAS) e link
    {
      allowedTags: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'hr',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
        'strong',
        'em',
        'del',
        'span',
        'div',
      ],
      allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    },
  );

  const metaBits = [
    <p key="r" className="my-1.5 flex items-baseline justify-between gap-3 text-sm">
      <span className={`shrink-0 ${muted}`}>Run</span>
      <b className="text-right font-mono text-xs font-semibold break-all">{detail.runId}</b>
    </p>,
    <p key="b" className="my-1.5 flex items-baseline justify-between gap-3 text-sm">
      <span className={`shrink-0 ${muted}`}>Browser</span>
      <b className="text-right font-mono text-xs font-semibold break-all">
        {browserLabel(detail.browser)}
      </b>
    </p>,
    <p key="v" className="my-1.5 flex items-baseline justify-between gap-3 text-sm">
      <span className={`shrink-0 ${muted}`}>Viewport</span>
      <b className="text-right font-mono text-xs font-semibold break-all">
        {viewportLabel(detail.viewport)}
      </b>
    </p>,
    ...(detail.duration
      ? [
        <p key="d" className="my-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className={`shrink-0 ${muted}`}>Durata</span>
          <b className="text-right font-mono text-xs font-semibold">{detail.duration}</b>
        </p>,
      ]
      : []),
  ];

  return (
    <div className={root}>
      <PageHeader title={testId} backLink={{ href: backHref, label: 'Torna indietro' }} />
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start pt-8 lg:sticky lg:top-[3.5rem] lg:max-h-screen lg:overflow-y-auto">
          <div className="border-grey border-b pb-5">
            {detail.status && (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${chipClass}`}
              >
                {statusIcon} {detail.status}
              </p>
            )}
            {metaBits}
            {detail.logUrl && (
              <p className="my-1.5 flex items-center justify-between gap-3 text-sm">
                <span className={`shrink-0 ${muted}`}>Log</span>
                <a
                  href={detail.logUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Apri il log completo della sessione in una nuova scheda"
                  className="border-grey bg-grey hover:border-dark-grey focus-visible:ring-primary/50 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold text-black transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Apri log
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              </p>
            )}
          </div>
        </aside>

        <main className="max-w-3xl min-w-0 pt-8 pb-24">
          {detail.status && (
            <div className={`mb-7 rounded-lg border-l-4 px-4 py-3.5 ${bannerClass}`}>
              <p className="flex items-center gap-2.5 font-semibold">
                {statusIcon} {bannerText}
              </p>
              {detail.reason && (
                <p className="mt-1.5 text-sm">
                  {detail.errorType && (
                    <code className="mr-1.5 font-mono font-semibold">{detail.errorType}</code>
                  )}
                  {detail.reason}
                </p>
              )}
            </div>
          )}

          {/* Report Markdown generato dall'agente (contenuto fidato, prodotto dalla pipeline) */}
          <ReportMarkdown html={html} />
        </main>
      </div>
    </div>
  );
}
