// Accesso server-side ad Azure DevOps (stato delle pipeline).
// Le credenziali restano SOLO lato server.

export type RunningBuild = {
    id: number;
    buildNumber: string;
    status: string;
    queueTime?: string;
    webUrl?: string;
};

/**
 * Restituisce le build della pipeline E2E attualmente in corso o in coda.
 * Ritorna un array vuoto se la configurazione non è presente o in caso di errore
 * (best-effort: la pagina dei report non deve rompersi per questo).
 */
export async function listRunningBuilds(): Promise<RunningBuild[]> {
    const org = process.env.AZURE_DEVOPS_ORG;
    const project = process.env.AZURE_DEVOPS_PROJECT;
    const pipelineId = process.env.AZURE_DEVOPS_PIPELINE_ID;
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (!org || !project || !pipelineId || !pat) return [];

    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/build/builds?definitions=${pipelineId}&statusFilter=inProgress,notStarted&$top=10&api-version=7.1`;
    const auth = Buffer.from(`:${pat}`).toString('base64');

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` },
            cache: 'no-store',
        });
        if (!res.ok) return [];

        const data = await res.json();
        return (data.value ?? []).map(
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
    } catch {
        return [];
    }
}
