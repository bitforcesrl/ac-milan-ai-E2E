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
    // Note per-test (override del campo `notes` in config.js per la run corrente)
    notesFailTest?: string;
    notesPdp?: string;
    notesPdpFuzzy?: string;
    notesQuickbuyCombinations?: string;
    notesQuickbuyPersonalization?: string;
    notesQuickbuyCartValidation?: string;
};

/**
 * GET: restituisce le build della pipeline attualmente in corso (o in coda).
 * Usato dalla home page per impedire l'avvio di run parallele.
 */
export async function GET() {
    const org = process.env.AZURE_DEVOPS_ORG;
    const project = process.env.AZURE_DEVOPS_PROJECT;
    const pipelineId = process.env.AZURE_DEVOPS_PIPELINE_ID;
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (!org || !project || !pipelineId || !pat) {
        return NextResponse.json(
            { error: "Configurazione Azure DevOps mancante." },
            { status: 500 },
        );
    }

    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/build/builds?definitions=${pipelineId}&statusFilter=inProgress,notStarted&$top=10&api-version=7.1`;
    const auth = Buffer.from(`:${pat}`).toString("base64");

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` },
            cache: "no-store",
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `Azure DevOps ha risposto con status ${res.status}` },
                { status: res.status },
            );
        }

        const data = await res.json();
        const running = (data.value ?? []).map(
            (b: {
                id: number;
                buildNumber: string;
                status: string;
                queueTime?: string;
                _links?: { web?: { href?: string } };
            }) => ({
                id: b.id,
                buildNumber: b.buildNumber,
                status: b.status,
                queueTime: b.queueTime,
                webUrl: b._links?.web?.href,
            }),
        );

        return NextResponse.json({ running });
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

    // Verifica che non ci siano già build in corso o in coda per questa pipeline
    const checkUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/build/builds?definitions=${pipelineId}&statusFilter=inProgress,notStarted&$top=10&api-version=7.1`;
    const auth = Buffer.from(`:${pat}`).toString("base64");

    try {
        const checkRes = await fetch(checkUrl, {
            headers: { Authorization: `Basic ${auth}` },
            cache: "no-store",
        });

        if (checkRes.ok) {
            const checkData = await checkRes.json();
            const running = (checkData.value ?? []).map(
                (b: {
                    id: number;
                    buildNumber: string;
                    status: string;
                    queueTime?: string;
                    _links?: { web?: { href?: string } };
                }) => ({
                    id: b.id,
                    buildNumber: b.buildNumber,
                    status: b.status,
                    queueTime: b.queueTime,
                    webUrl: b._links?.web?.href,
                }),
            );

            if (running.length > 0) {
                return NextResponse.json(
                    {
                        error:
                            "Esistono già run E2E in corso: attendere il completamento prima di avviarne una nuova.",
                        running,
                    },
                    { status: 409 },
                );
            }
        }
        // Se il check fallisce si prosegue comunque con il trigger (best-effort)
    } catch (err) {
        console.error("Errore durante la chiamata ad Azure DevOps:", err);
        return NextResponse.json(
            {
                error: "Errore durante la chiamata ad Azure DevOps",
                details: err instanceof Error ? err.message : String(err),
            },
            { status: 502 },
        );
        // Ignora errori di rete sul check: il trigger viene tentato comunque
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
        console.error("Errore durante la chiamata ad Azure DevOps:", err);
        return NextResponse.json(
            {
                error: "Errore durante la chiamata ad Azure DevOps",
                details: err instanceof Error ? err.message : String(err),
            },
            { status: 502 },
        );
    }
}