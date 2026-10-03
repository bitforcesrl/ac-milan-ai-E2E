import { NextResponse } from "next/server";
import {
    parseRunConfig,
    RunConfigValidationError,
} from "@/lib/run-config-schema";
import {
    E2E_TEST_LIST,
    BROWSER_LIST,
    VIEWPORT_LIST,
    AI_MODEL_LIST,
    MAX_PARALLEL_SESSIONS_CONFIG,
} from "@/lib/e2e-tests";

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
 * Body: run config della run selezionata dal form in home page (stesso schema
 * dei file configs/*.config.json). Viene validata con Zod contro il catalogo in
 * configs/index.ts e passata alla pipeline come build variable E2E_RUN_CONFIG
 * (queue-time, NON come template parameter). La pipeline la materializza su
 * file temporaneo e la passa a run-e2e.mjs via --config (vedi azure-pipelines.yml).
 */

// Catalogo per la validazione della run config (da configs/index.ts via e2e-tests.ts)
const RUN_CONFIG_CATALOG = {
    E2E_TESTS: E2E_TEST_LIST,
    BROWSERS: BROWSER_LIST,
    VIEWPORTS: VIEWPORT_LIST,
    AI_MODELS: AI_MODEL_LIST,
    MAX_PARALLEL_SESSIONS: MAX_PARALLEL_SESSIONS_CONFIG,
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
    // Run config dal form in home page: validata con Zod contro il catalogo
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Body mancante o non JSON: inviare una run config valida." },
            { status: 400 },
        );
    }

    let runConfigJson: string;
    try {
        const runConfig = parseRunConfig(body, RUN_CONFIG_CATALOG);
        runConfigJson = JSON.stringify(runConfig);
    } catch (err) {
        if (err instanceof RunConfigValidationError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
    }

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
                templateParameters: {
                    e2eRunConfig: runConfigJson,
                    // Titolo fisso della run: usato dal name condizionale nel
                    // YAML (buildTitle via REST viene ignorato da ADO).
                    // NB: il titolo diventa build number, quindi non deve
                    // contenere caratteri vietati (":", "/", "\"", ecc.).
                    e2eRunTitle: `Run avviata dall'app E2E · ${new Date()
                        .toLocaleString("it-IT", {
                            timeZone: "Europe/Rome",
                            dateStyle: "short",
                            timeStyle: "short",
                        })
                        .replaceAll(":", ".")
                        .replaceAll("/", "-")}`,
                },
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