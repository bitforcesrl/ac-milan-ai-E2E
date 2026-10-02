import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { getTest } from '@/lib/azure-reports';
import { CheckCircle, XCircle } from '@deemlol/next-icons';
import PageHeader from '@/components/PageHeader';
import ReportMarkdown from '@/components/ReportMarkdown';

export const dynamic = 'force-dynamic';

const root = 'min-h-screen bg-white text-black antialiased';
const muted = 'text-dark-grey';

export default async function TestDetailPage({
    params,
}: {
    params: Promise<{ runId: string; browser: string; viewport: string; testId: string }>;
}) {
    const { runId, browser, viewport, testId } = await params;
    const detail = await getTest(runId, browser, viewport, testId);

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
    const backHref = `/reports/${runId}`;

    // I report linkano gli screenshot con percorso relativo (../screenshots/<file>.png):
    // li riscriviamo con gli URL SAS dei blob cosi' le immagini si vedono nella pagina.
    const shotsByName = new Map(detail.screenshots.map((s) => [s.name, s.url]));
    const html = sanitizeHtml(
        await marked.parse(
            detail.report.replace(
                /\]\((?:\.\.\/)*screenshots\/([^)\s]+)\)/g,
                (match, name) => {
                    const url = shotsByName.get(name);
                    return url ? `](${url})` : match;
                },
            ),
        ),
        // Consentiti: tag Markdown standard + immagini (screenshot con URL SAS) e link
        {
            allowedTags: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
                'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'img', 'strong', 'em', 'del', 'span', 'div',
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
        <p key="r" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Run</span><b className="text-right font-mono text-xs font-semibold break-all">{detail.runId}</b></p>,
        <p key="b" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Browser</span><b className="text-right font-mono text-xs font-semibold break-all">{detail.browser}</b></p>,
        <p key="v" className="my-1.5 flex items-baseline justify-between gap-3 text-sm"><span className={`shrink-0 ${muted}`}>Viewport</span><b className="text-right font-mono text-xs font-semibold break-all">{detail.viewport}</b></p>,
    ];

    return (
        <div className={root}>
            <PageHeader
                title={testId}
                backLink={{ href: backHref, label: 'Torna indietro' }}
            />
            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="self-start pt-8 lg:sticky lg:top-[3.5rem] lg:max-h-screen lg:overflow-y-auto">
                    <div className="border-b border-grey pb-5">
                        {detail.status && (
                            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isPass ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-700'}`}>
                                {isPass ? <CheckCircle size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" className="text-red-600" />} {isPass ? 'PASS' : 'FAIL'}
                            </p>
                        )}
                        {metaBits}
                    </div>
                </aside>

                <main className="min-w-0 max-w-3xl pt-8 pb-24">
                    {detail.status && (
                        <p className={`mb-7 flex items-center gap-2.5 rounded-lg px-4 py-3.5 font-semibold border-l-4 ${isPass ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'}`}>
                            {isPass ? (
                                <><CheckCircle size={18} aria-hidden="true" /> Test superato con successo</>
                            ) : (
                                <><XCircle size={18} aria-hidden="true" /> Test fallito - Verificare gli errori</>
                            )}
                        </p>
                    )}

                    {/* Report Markdown generato dall'agente (contenuto fidato, prodotto dalla pipeline) */}
                    <ReportMarkdown html={html} />
                </main>
            </div>
        </div>
    );
}
