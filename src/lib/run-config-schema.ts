// Schema Zod della run config: unico contratto condiviso tra
// - i file configs/*.json (pipeline, local, mr)
// - il form Next.js (PipelineForm) e l'API /api/azure-pipeline
// Gli id di test/browser/viewport/aiModel vengono validati contro il catalogo
// in config.ts (vedi validateRunConfigAgainstCatalog).

import { z } from "zod";

export const RUN_CONFIG_FILE_NAMES = [
    "pipeline",
    "local",
    "mr",
] as const;

export const runConfigSchema = z.object({
    // Test selezionati: id obbligatorio, note opzionali (override del campo
    // `notes` del catalogo in config.ts per la run corrente)
    tests: z
        .array(
            z.object({
                id: z.string().min(1),
                notes: z.string().optional(),
            }),
        )
        .min(1, "Selezionare almeno un test."),
    browsers: z.array(z.string().min(1)).min(1, "Selezionare almeno un browser."),
    viewports: z.array(z.string().min(1)).min(1, "Selezionare almeno un viewport."),
    aiModel: z.string().min(1),
    maxParallelSessions: z.number().int().min(1),
});

export type RunConfig = z.infer<typeof runConfigSchema>;

export type RunConfigTest = RunConfig["tests"][number];

export class RunConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RunConfigValidationError";
    }
}

/**
 * Valida una run config (da form o file JSON) contro lo schema Zod e contro il
 * catalogo in config.ts: solleva RunConfigValidationError con un messaggio
 * aggregato in caso di errore.
 */
export function parseRunConfig(
    raw: unknown,
    catalog: {
        E2E_TESTS: { id: string }[];
        BROWSERS: { id: string }[];
        VIEWPORTS: { id: string }[];
        AI_MODELS: string[];
        MAX_PARALLEL_SESSIONS: { options: number[] };
    },
): RunConfig {
    const parsed = runConfigSchema.safeParse(raw);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("; ");
        throw new RunConfigValidationError(`Run config non valida: ${issues}`);
    }

    const config = parsed.data;
    const errors: string[] = [];

    const testIds = new Set(catalog.E2E_TESTS.map((t) => t.id));
    for (const test of config.tests) {
        if (!testIds.has(test.id)) errors.push(`Test sconosciuto: ${test.id}`);
    }

    const browserIds = new Set(catalog.BROWSERS.map((b) => b.id));
    for (const browser of config.browsers) {
        if (!browserIds.has(browser)) errors.push(`Browser sconosciuto: ${browser}`);
    }

    const viewportIds = new Set(catalog.VIEWPORTS.map((v) => v.id));
    for (const viewport of config.viewports) {
        if (!viewportIds.has(viewport)) errors.push(`Viewport sconosciuto: ${viewport}`);
    }

    if (!catalog.AI_MODELS.includes(config.aiModel)) {
        errors.push(`Modello AI non disponibile: ${config.aiModel}`);
    }

    if (!catalog.MAX_PARALLEL_SESSIONS.options.includes(config.maxParallelSessions)) {
        errors.push(
            `Sessioni in parallelo non valide: ${config.maxParallelSessions} (valori ammessi: ${catalog.MAX_PARALLEL_SESSIONS.options.join(", ")})`,
        );
    }

    if (errors.length) {
        throw new RunConfigValidationError(`Run config non valida: ${errors.join("; ")}`);
    }

    return config;
}
