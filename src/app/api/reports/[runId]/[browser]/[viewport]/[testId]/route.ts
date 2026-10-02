import { NextResponse } from "next/server";
import { getTest } from "@/lib/azure-reports";

/**
 * API di dettaglio di un singolo test:
 * GET /api/reports/{runId}/{browser}/{viewport}/{testId}
 * → { test: TestDetail } (report Markdown + screenshot con URL SAS) o 404/500.
 *
 * Parametri (tutti e quattro obbligatori, nell'ordine):
 * - `runId`:    stamp della run = cartella report su blob, formato
 *               "YYYY-MM-DD_HH-mm-ss" (UTC), es. "2026-09-28_10-44-25"
 *               (lo si ottiene da GET /api/reports o GET /api/reports/{runId})
 * - `browser`:  id del browser della sessione, es. "chromium" | "firefox" | "webkit"
 * - `viewport`: id del viewport della sessione, es. "1280x650" | "768x1024" | "390x844"
 * - `testId`:   id del test come definito in config.ts, es. "quickbuy-cart-validation"
 *               (uguale al campo `id` in sessions[].tests[] del dettaglio run)
 *
 * Esempio di chiamata:
 *
 *   GET /api/reports/2026-09-28_10-44-25/chromium/1280x650/quickbuy-cart-validation
 *
 * → { test: { runId: "2026-09-28_10-44-25", browser: "chromium",
 *             viewport: "1280x650", status: "PASS",
 *             report: "# Report test: ... (contenuto Markdown del report)",
 *             screenshots: [{ name: "quickbuy-cart-validation-001.png",
 *                             url: "https://...blob...?SAS", description: "..." }] }
 *
 * Variabili d'ambiente: AZURE_STORAGE_CONNECTION_STRING,
 * AZURE_STORAGE_CONTAINER (default "e2e-reports").
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ runId: string; browser: string; viewport: string; testId: string }> },
) {
    const { runId, browser, viewport, testId } = await params;
    try {
        const test = await getTest(runId, browser, viewport, testId);
        if (!test) {
            return NextResponse.json(
                { error: `Test '${testId}' non trovato (run '${runId}', ${browser}/${viewport}).` },
                { status: 404 },
            );
        }
        return NextResponse.json({ test });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[api/reports/${runId}/${browser}/${viewport}/${testId}] Errore recupero test: ${message}`);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}