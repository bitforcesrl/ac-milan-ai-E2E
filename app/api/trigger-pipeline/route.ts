import { NextResponse } from "next/server";

/**
 * API per triggerare la pipeline E2E su Azure DevOps tramite REST API.
 *
 * Variabili d'ambiente richieste (solo server-side):
 * - AZURE_DEVOPS_ORG: nome dell'organizzazione Azure DevOps
 * - AZURE_DEVOPS_PROJECT: nome del progetto
 * - AZURE_DEVOPS_PIPELINE_ID: id della definizione di build (pipeline)
 * - AZURE_DEVOPS_PAT: Personal Access Token con permesso "Build (Read & Execute)"
 * - AZURE_DEVOPS_BRANCH (opzionale, default: main)
 *
 * Body (opzionale): configurazione della run selezionata dal form in home page.
 * I campi vengono inoltrati come templateParameters alla pipeline
 * (vedi `parameters:` in azure-pipelines.yml).
 */

type PipelineConfig = {
    runChromium?: boolean;
    runFirefox?: boolean;
    runWebkit?: boolean;
    runDesktop?: boolean;
    runTablet?: boolean;
    runMobile?: boolean;
    openrouterAiModel?: string;
    maxParallelSessions?: string;
    failTest?: boolean;
    pdp?: boolean;
    pdpFuzzy?: boolean;
    quickbuyCombinations?: boolean;
    quickbuyPersonalization?: boolean;
    quickbuyCartValidation?: boolean;
};

export async function POST(request: Request) {
    const org = process.env.AZURE_DEVOPS_ORG;
    const project = process.env.AZURE_DEVOPS_PROJECT;
    const pipelineId = process.env.AZURE_DEVOPS_PIPELINE_ID;
    const pat = process.env.AZURE_DEVOPS_PAT;
    const branch = process.env.AZURE_DEVOPS_BRANCH || "main";

    if (!org || !project || !pipelineId || !pat) {
        return NextResponse.json(
            {
                error:
                    "Configurazione Azure DevOps mancante. Impostare AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PIPELINE_ID e AZURE_DEVOPS_PAT.",
            },
            { status: 500 },
        );
    }

    // Configurazione opzionale dal form in home page
    let config: PipelineConfig = {};
    try {
        const body = await request.json();
        if (body && typeof body === "object") {
            config = body as PipelineConfig;
        }
    } catch {
        // Body assente o non JSON: si usa il default dei parametri della pipeline
    }

    // Costruisce i templateParameters solo con i campi effettivamente presenti
    const templateParameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
        if (value === undefined || value === null) continue;
        templateParameters[key] = String(value);
    }

    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/build/builds?api-version=7.1`;

    const auth = Buffer.from(`:${pat}`).toString("base64");

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                definition: { id: Number(pipelineId) },
                sourceBranch: `refs/heads/${branch}`,
                ...(Object.keys(templateParameters).length > 0
                    ? { templateParameters }
                    : {}),
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: `Azure DevOps ha risposto con status ${res.status}`,
                    details: data,
                },
                { status: res.status },
            );
        }

        return NextResponse.json({
            ok: true,
            buildId: data.id,
            buildNumber: data.buildNumber,
            webUrl: data._links?.web?.href,
            status: data.status,
        });
    } catch (err) {
        return NextResponse.json(
            {
                error: "Errore durante la chiamata ad Azure DevOps",
                details: err instanceof Error ? err.message : String(err),
            },
            { status: 502 },
        );
    }
}