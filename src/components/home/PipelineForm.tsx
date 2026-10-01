"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Play,
    CheckCircle,
    XCircle,
    Monitor,
    Layers,
    Cpu,
} from "@deemlol/next-icons";
import {
    E2E_TEST_LIST,
    BROWSER_LIST,
    VIEWPORT_LIST,
    AI_MODEL_LIST,
    MAX_PARALLEL_SESSIONS_CONFIG,
    testIdToPipelineParam,
    browserIdToPipelineParam,
    viewportIdToPipelineParam,
} from "@/lib/e2e-tests";

const FIELDSET_LEGEND_CLASS =
    "mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-dark-grey";

const SECTION_CARD_CLASS =
    "rounded-xl border border-grey bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover";

// Chiavi derivate dinamicamente da config.js:
// - browser/viewport: runChromium, runDesktop, ... (parametri pipeline)
// - test: quickbuyCartValidation, ... (parametri pipeline)
type FormState = {
    [param: string]: boolean | string;
};

const DEFAULT_FORM: FormState = {
    // Default browser/viewport = campo `default` in config.js
    ...Object.fromEntries(
        BROWSER_LIST.map((b) => [browserIdToPipelineParam(b.id), b.default]),
    ),
    ...Object.fromEntries(
        VIEWPORT_LIST.map((v) => [viewportIdToPipelineParam(v.label), v.default]),
    ),
    openrouterAiModel: AI_MODEL_LIST[0],
    maxParallelSessions: String(MAX_PARALLEL_SESSIONS_CONFIG.default),
    // Default dei test = campo `enabled` in config.js
    ...Object.fromEntries(
        E2E_TEST_LIST.map((t) => [testIdToPipelineParam(t.id), t.enabled]),
    ),
    // Default note per-test = campo `notes` in config.js
    ...Object.fromEntries(
        E2E_TEST_LIST.map((t) => [notesParamForTest(t.id), t.notes]),
    ),
};

// Chiave form/pipeline per la nota di un test, es. 'pdp' -> 'notesPdp'
function notesParamForTest(id: string): string {
    return "notes" + testIdToPipelineParam(id).charAt(0).toUpperCase() + testIdToPipelineParam(id).slice(1);
}

const AI_MODELS: string[] = AI_MODEL_LIST;
const PARALLEL_OPTIONS: string[] = MAX_PARALLEL_SESSIONS_CONFIG.options.map(
    String,
);

const BROWSERS: { key: string; label: string }[] = BROWSER_LIST.map((b) => ({
    key: browserIdToPipelineParam(b.id),
    label: b.id.charAt(0).toUpperCase() + b.id.slice(1),
}));

const VIEWPORTS: { key: string; label: string }[] = VIEWPORT_LIST.map((v) => ({
    key: viewportIdToPipelineParam(v.label),
    label: `${v.label} (${v.id})`,
}));

// Lista test derivata da config.js: label = "<id> (<file>)", chiave = parametro pipeline
const TESTS: { key: string; label: string; description: string; notesKey: string }[] =
    E2E_TEST_LIST.map((t) => ({
        key: testIdToPipelineParam(t.id),
        label: t.name,
        description: t.description,
        notesKey: notesParamForTest(t.id),
    }));

/**
 * Form di configurazione e avvio della pipeline E2E (client component foglia).
 * La pagina (`src/app/page.tsx`) resta un Server Component e delega qui
 * tutta la stato/interattività.
 */
export default function PipelineForm() {
    const [state, setState] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    function setField(key: string, value: boolean | string) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function triggerPipeline() {
        setState("loading");
        setErrorMessage(null);

        try {
            const res = await fetch("/api/azure-pipeline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                // 409: il server ha rilevato run già in corso
                setErrorMessage(data?.error ?? `Errore HTTP ${res.status}`);
                setState("error");
                return;
            }
            setState("success");
        } catch {
            setErrorMessage("Errore di rete durante la chiamata all'API.");
            setState("error");
        }
    }

    return (
        <form
            className="mx-auto flex w-full flex-col gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                triggerPipeline();
            }}
        >
            {/* Ambiente: browser + viewport */}
            <section className={`${SECTION_CARD_CLASS} animate-fade-up`}>
                <h2 className="text-xl font-semibold text-black">
                    Configurazione run
                </h2>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    <fieldset className="flex flex-col gap-3">
                        <legend className={FIELDSET_LEGEND_CLASS}>
                            <Monitor size={14} aria-hidden="true" />
                            Browser
                        </legend>
                        {BROWSERS.map(({ key, label }) => (
                            <label
                                key={key}
                                className="flex items-center gap-3 text-sm text-black"
                            >
                                <input
                                    type="checkbox"
                                    className={CHECKBOX_CLASS}
                                    checked={form[key] as boolean}
                                    onChange={(e) => setField(key, e.target.checked as never)}
                                />
                                {label}
                            </label>
                        ))}
                    </fieldset>

                    <fieldset className="flex flex-col gap-3">
                        <legend className={FIELDSET_LEGEND_CLASS}>
                            <Layers size={14} aria-hidden="true" />
                            Viewport
                        </legend>
                        {VIEWPORTS.map(({ key, label }) => (
                            <label
                                key={key}
                                className="flex items-center gap-3 text-sm text-black"
                            >
                                <input
                                    type="checkbox"
                                    className={CHECKBOX_CLASS}
                                    checked={form[key] as boolean}
                                    onChange={(e) => setField(key, e.target.checked as never)}
                                />
                                {label}
                            </label>
                        ))}
                    </fieldset>
                </div>
            </section>

            {/* Esecuzione: modello AI + sessioni parallele */}
            <section className={`${SECTION_CARD_CLASS} animate-fade-up`} style={{ animationDelay: "80ms" }}>
                <fieldset className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                    <legend className={FIELDSET_LEGEND_CLASS}>
                        <Play size={14} aria-hidden="true" />
                        Esecuzione
                    </legend>
                    <label className="flex flex-col gap-2 text-sm font-medium text-black">
                        AI Model (OpenRouter)
                        <select
                            className={SELECT_CLASS}
                            value={form.openrouterAiModel as string}
                            onChange={(e) => setField("openrouterAiModel", e.target.value)}
                        >
                            {AI_MODELS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-black">
                        Sessioni in parallelo
                        <select
                            className={SELECT_CLASS}
                            value={form.maxParallelSessions as string}
                            onChange={(e) =>
                                setField("maxParallelSessions", e.target.value)
                            }
                        >
                            {PARALLEL_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                    {o}
                                </option>
                            ))}
                        </select>
                    </label>
                </fieldset>
            </section>

            {/* Test E2E */}
            <section className={`${SECTION_CARD_CLASS} animate-fade-up`} style={{ animationDelay: "160ms" }}>
                <fieldset className="flex flex-col gap-4">
                    <legend className={FIELDSET_LEGEND_CLASS}>
                        <Cpu size={14} aria-hidden="true" />
                        Test E2E
                    </legend>
                    {TESTS.map(({ key, label, description, notesKey }) => (
                        <div
                            key={key}
                            className="flex flex-col gap-2 rounded-lg border border-grey bg-grey/40 px-4 py-3.5 transition-colors duration-200 hover:border-dark-grey/40 hover:bg-grey/70"
                        >
                            <label className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    className={`${CHECKBOX_CLASS} mt-0.5`}
                                    checked={form[key] as boolean}
                                    onChange={(e) => setField(key, e.target.checked as never)}
                                />
                                <span className="text-sm font-semibold leading-6 text-black">
                                    {label}
                                </span>
                            </label>
                            {description && (
                                <p className="pl-7 text-xs leading-5 text-dark-grey">
                                    {description}
                                </p>
                            )}
                            {Boolean(form[key]) && (
                                <label className="flex flex-col gap-1 pl-7 text-xs text-dark-grey">
                                    Eventuali note per l{"'"}agente AI (opzionale)
                                    <textarea
                                        className={TEXTAREA_CLASS}
                                        rows={3}
                                        value={form[notesKey] as string}
                                        onChange={(e) => setField(notesKey, e.target.value)}
                                    />
                                </label>
                            )}
                        </div>
                    ))}
                </fieldset>
            </section>

            <div className="flex justify-center animate-fade-up" style={{ animationDelay: "240ms" }}>
                <button
                    type="submit"
                    disabled={state === "loading"}
                    className="flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-primary/85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                    <Play size={18} />
                    <span>
                        {state === "loading"
                            ? "Avvio pipeline…"
                            : "Avvia test E2E"}</span>
                </button>
            </div>

            {state === "success" && (
                <div
                    role="status"
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-card animate-fade-up"
                >
                    <CheckCircle size={18} aria-hidden="true" className="shrink-0" />
                    <span className="font-medium">
                        Pipeline avviata con la configurazione selezionata, è in corso.
                    </span>
                    <Link
                        href="/reports"
                        className="font-semibold text-green-800 underline underline-offset-2 transition-colors hover:text-green-900"
                    >
                        Vai ai report →
                    </Link>
                </div>
            )}
            {state === "error" && (
                <div
                    role="alert"
                    className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-card animate-fade-up"
                >
                    <XCircle size={18} aria-hidden="true" className="shrink-0 text-red-600" />
                    <span>
                        Errore: la pipeline non è stata avviata.
                        {errorMessage ? ` (${errorMessage})` : ""}
                    </span>
                </div>
            )}
        </form>
    );
}

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-dark-grey bg-white accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

const TEXTAREA_CLASS =
    "w-full rounded-md border border-grey bg-white px-3 py-2 text-sm text-black placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

const SELECT_CLASS =
    "h-10 rounded-md border border-grey bg-white px-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer";