import { NextResponse } from "next/server";
import { listRuns } from "@/lib/azure-reports";

/**
 * API che alimenta la tabella della dashboard /reports.
 *
 * GET /api/reports → { runs: RunSummary[] }
 *
 * I dati provengono dal blob "index.json" alla radice del container
 * AZURE_STORAGE_CONTAINER (default "e2e-reports"), scritto e mantenuto
 * aggiornato dalla pipeline E2E (scripts/run-index.mjs + upload-reports-to-azure.mjs).
 * Se index.json è assente/malformato/vuoto, listRuns ricade automaticamente
 * sulla scansione completa dei blob (storici pre-index).
 *
 * Convenzioni di risposta (allineate a /api/azure-pipeline):
 * - 200 { runs: [...] } in caso di successo (anche con array vuoto)
 * - 500 { error: string } se Azure Blob non è raggiungibile/configurato
 */
export async function GET() {
    try {
        const runs = await listRuns();
        return NextResponse.json({ runs });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[api/reports] Errore recupero run: ${message}`);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}