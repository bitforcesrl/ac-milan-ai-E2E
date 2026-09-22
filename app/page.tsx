"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart2, Play } from "@deemlol/next-icons";
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

const BUTTON_CLASS =
  "flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-milan-pulse text-base text-black transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";

const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-zinc-600 bg-zinc-800 focus:ring-zinc-100 cursor-pointer";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-100";

const SELECT_CLASS =
  "h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-100 cursor-pointer";

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
const TESTS: { key: string; label: string; notesKey: string }[] =
  E2E_TEST_LIST.map((t) => ({
    key: testIdToPipelineParam(t.id),
    label: `${t.id} (${t.file})`,
    notesKey: notesParamForTest(t.id),
  }));

export default function Home() {
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
      const res = await fetch("/api/trigger-pipeline", {
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
    <div className="flex flex-col flex-1 items-center justify-center bg-black font-sans">
      <main className="flex flex-1 w-full max-w-4xl flex-col gap-8 py-16 px-8 bg-black sm:px-16">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            AC Milan — AI E2E Tests
          </h1>
          <Link
            href="/reports"
            className={BUTTON_CLASS}
          >
            <BarChart2 size={18} />
            Reports
          </Link>
        </header>
        <p className="text-lg leading-8 text-zinc-400">
          Test automatici del personalizzatore di maglie dell’e-commerce,
          eseguiti da agenti AI come fossero utenti reali. Ogni run produce un
          report con esiti, bug e screenshot.
        </p>

        <form
          className="flex flex-col gap-6 rounded-xl border border-zinc-800 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            triggerPipeline();
          }}
        >
          <h2 className="text-xl font-semibold text-zinc-50">
            Configurazione run
          </h2>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Browser
            </legend>
            {BROWSERS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 text-sm text-zinc-100"
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
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Viewport
            </legend>
            {VIEWPORTS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 text-sm text-zinc-100"
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

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-100">
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
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-100">
              Sessioni in parallelo (browser x viewport)
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
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Test E2E
            </legend>
            {TESTS.map(({ key, label, notesKey }) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="flex items-center gap-3 text-sm text-zinc-100">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={form[key] as boolean}
                    onChange={(e) => setField(key, e.target.checked as never)}
                  />
                  {label}
                </label>
                {Boolean(form[key]) && (
                  <label className="flex flex-col gap-1 pl-7 text-xs text-zinc-400">
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

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={state === "loading"}
              className={BUTTON_CLASS}
            >
              <Play size={18} />
              <span>
                {state === "loading"
                  ? "Avvio pipeline…"
                  : "Avvia test E2E"}</span>
            </button>
          </div>

          {state === "success" && (
            <p className="text-sm text-green-400">
              Pipeline avviata con la configurazione selezionata, è in corso.
            </p>
          )}
          {state === "error" && (
            <p className="text-sm text-red-400">
              Errore: la pipeline non è stata avviata.
              {errorMessage ? ` (${errorMessage})` : ""}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
