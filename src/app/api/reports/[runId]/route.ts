import { NextResponse } from "next/server";
import { getRun } from "@/lib/azure-reports";

/**
 * API di dettaglio di una run: GET /api/reports/{runId}
 * → { run: RunDetail } (sessions con test, bug, screenshot) o 404/500.
 *
 * `runId` è lo stamp della run = nome della cartella report su blob
 * (formato "YYYY-MM-DD_HH-mm-ss", UTC). Esempio di chiamata:
 *
 *   GET /api/reports/2026-09-28_10-44-25
 *
 * → { run: { runId: "2026-09-28_10-44-25", date: "2026-09-28T10:44:25Z",
 *            status: "PASS", pass: 3, fail: 0, total: 3, passRate: 100,
 *            bugs: { high: 0, medium: 0, low: 0 }, duration: "12m 0s",
 *            environments: [{ browser: "chromium", viewport: "1280x650" }],
 *            sessions: [{ browser: "chromium", viewport: "1280x650", ...,
 *                         tests: [{ id: "quickbuy-cart-validation", ... }] }] }
 *
 * L'id di ogni test in `sessions[].tests[].id` si usa per l'endpoint di
 * dettaglio del singolo test (vedi app/api/reports/[runId]/[browser]/[viewport]/[testId]/route.ts).
 *
 * Variabili d'ambiente: AZURE_STORAGE_CONNECTION_STRING,
 * AZURE_STORAGE_CONTAINER (default "e2e-reports").
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ runId: string }> },
) {
    const { runId } = await params;
    try {
        const run = await getRun(runId);
        if (!run) {
            return NextResponse.json({ error: `Run '${runId}' non trovata.` }, { status: 404 });
        }
        return NextResponse.json({ run });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[api/reports/${runId}] Errore recupero dettaglio run: ${message}`);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}