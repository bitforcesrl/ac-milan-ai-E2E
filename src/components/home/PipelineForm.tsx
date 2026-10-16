'use client';

import {
  AI_MODEL_LIST,
  BROWSER_LIST,
  E2E_TEST_LIST,
  MAX_PARALLEL_SESSIONS_CONFIG,
  VIEWPORT_LIST,
  buildDefaultRunConfig,
} from '@/lib/e2e-tests';
import type { RunConfig } from '@/lib/run-config-schema';
import {
  CheckCircle,
  Columns,
  Cpu,
  Layers,
  List,
  Mail,
  Monitor,
  Play,
  X,
  XCircle,
} from '@deemlol/next-icons';
import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';

const FIELDSET_LEGEND_CLASS =
  'mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-dark-grey';

const SECTION_CARD_CLASS =
  'rounded-xl border border-grey bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover';

// Il form produce direttamente la run config (stesso schema dei file
// configs/*.json), inviata come JSON all'API /api/azure-pipeline.
const DEFAULT_CONFIG: RunConfig = buildDefaultRunConfig();

const AI_MODELS: string[] = AI_MODEL_LIST;
const PARALLEL_OPTIONS: number[] = MAX_PARALLEL_SESSIONS_CONFIG.options;

const BROWSERS: { id: string; label: string }[] = BROWSER_LIST.map((b) => ({
  id: b.id,
  label: b.label,
}));

// La label del catalogo include gia' il device emulato (es. "Tablet (iPad Pro 11)"):
// l'id e' il nome dell'ambiente (desktop/tablet/mobile), non va mostrato.
const VIEWPORTS: { id: string; label: string }[] = VIEWPORT_LIST.map((v) => ({
  id: v.id,
  label: v.label,
}));

// Lista test derivata da configs/index.ts: label = name, note precompilate dal catalogo
const TESTS: { id: string; label: string; description: string }[] = E2E_TEST_LIST.map((t) => ({
  id: t.id,
  label: t.name,
  description: t.description,
}));

/**
 * Form di configurazione e avvio della pipeline E2E (client component foglia).
 * La pagina (`src/app/page.tsx`) resta un Server Component e delega qui
 * tutta la stato/interattività. Produce una run config JSON (stesso schema dei
 * file configs/*.json) inviata all'API /api/azure-pipeline.
 */
const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export default function PipelineForm({ localMode = false }: { localMode?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // In modalità locale il default è "headed": il browser visibile è il caso d'uso principale
  const [config, setConfig] = useState<RunConfig>(
    localMode ? { ...DEFAULT_CONFIG, browserMode: 'headed' } : DEFAULT_CONFIG,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    browsers?: string;
    viewports?: string;
    tests?: string;
  }>({});

  function toggleBrowser(id: string, checked: boolean) {
    setConfig((prev) => ({
      ...prev,
      browsers: checked ? [...prev.browsers, id] : prev.browsers.filter((b) => b !== id),
    }));
  }

  function toggleViewport(id: string, checked: boolean) {
    setConfig((prev) => ({
      ...prev,
      viewports: checked ? [...prev.viewports, id] : prev.viewports.filter((v) => v !== id),
    }));
  }

  function toggleTest(id: string, checked: boolean) {
    setConfig((prev) => ({
      ...prev,
      tests: checked
        ? [
            ...prev.tests,
            {
              id,
              notes: E2E_TEST_LIST.find((t) => t.id === id)?.notes ?? '',
            },
          ]
        : prev.tests.filter((t) => t.id !== id),
    }));
  }

  const allTestsSelected =
    TESTS.length > 0 && TESTS.every((t) => config.tests.some((sel) => sel.id === t.id));
  const someTestsSelected = config.tests.length > 0 && !allTestsSelected;

  function toggleAllTests(checked: boolean) {
    setConfig((prev) => ({
      ...prev,
      tests: checked
        ? TESTS.map((t) => ({
            id: t.id,
            notes: E2E_TEST_LIST.find((e) => e.id === t.id)?.notes ?? '',
          }))
        : [],
    }));
  }

  function setTestNotes(id: string, notes: string) {
    setConfig((prev) => ({
      ...prev,
      tests: prev.tests.map((t) => (t.id === id ? { ...t, notes } : t)),
    }));
  }

  function addEmailRecipient(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setEmailError(`"${email}" non è un indirizzo email valido.`);
      return;
    }
    if (config.emailRecipients?.includes(email)) {
      setEmailError(`"${email}" è già tra i destinatari.`);
      return;
    }
    if ((config.emailRecipients?.length ?? 0) >= 20) {
      setEmailError('Massimo 20 destinatari email.');
      return;
    }

    setEmailError(null);
    setEmailInput('');
    setConfig((prev) => ({
      ...prev,
      emailRecipients: [...(prev.emailRecipients ?? []), email],
    }));
  }

  function removeEmailRecipient(email: string) {
    setEmailError(null);
    setConfig((prev) => ({
      ...prev,
      emailRecipients: (prev.emailRecipients ?? []).filter((r) => r !== email),
    }));
  }

  function handleEmailInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (e.key !== 'Tab' || emailInput.trim()) {
        e.preventDefault();
        addEmailRecipient(emailInput);
      }
    } else if (e.key === 'Backspace' && !emailInput) {
      const last = config.emailRecipients?.at(-1);
      if (last) removeEmailRecipient(last);
    }
  }

  function validateConfig(): boolean {
    const errors: typeof validationErrors = {};
    if (config.browsers.length === 0) {
      errors.browsers = 'Selezionare almeno un browser.';
    }
    if (config.viewports.length === 0) {
      errors.viewports = 'Selezionare almeno un viewport.';
    }
    if (config.tests.length === 0) {
      errors.tests = 'Selezionare almeno un test E2E.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function triggerPipeline() {
    setErrorMessage(null);
    if (!validateConfig()) {
      return;
    }
    setState('loading');

    try {
      const res = await fetch('/api/azure-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 409: il server ha rilevato run già in corso
        setErrorMessage(data?.error ?? `Errore HTTP ${res.status}`);
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMessage("Errore di rete durante la chiamata all'API.");
      setState('error');
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
        <h2 className="text-xl font-semibold text-black">Configurazione run</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <fieldset className="flex flex-col gap-3">
            <legend className={FIELDSET_LEGEND_CLASS}>
              <Monitor size={14} aria-hidden="true" />
              Browser
            </legend>
            {BROWSERS.map(({ id, label }) => (
              <label
                key={id}
                htmlFor={`browser-${id}`}
                className="flex cursor-pointer items-center gap-3 text-sm text-black"
              >
                <input
                  id={`browser-${id}`}
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={config.browsers.includes(id)}
                  onChange={(e) => toggleBrowser(id, e.target.checked)}
                />
                {label}
              </label>
            ))}
            {validationErrors.browsers && (
              <p role="alert" className="text-xs text-red-600">
                {validationErrors.browsers}
              </p>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={FIELDSET_LEGEND_CLASS}>
              <Layers size={14} aria-hidden="true" />
              Viewport
            </legend>
            {VIEWPORTS.map(({ id, label }) => (
              <label
                key={id}
                htmlFor={`viewport-${id}`}
                className="flex cursor-pointer items-center gap-3 text-sm text-black"
              >
                <input
                  id={`viewport-${id}`}
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={config.viewports.includes(id)}
                  onChange={(e) => toggleViewport(id, e.target.checked)}
                />
                {label}
              </label>
            ))}
            {validationErrors.viewports && (
              <p role="alert" className="text-xs text-red-600">
                {validationErrors.viewports}
              </p>
            )}
          </fieldset>
          <div className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className={FIELDSET_LEGEND_CLASS}>
                <Cpu size={14} aria-hidden="true" />
                AI Model
              </legend>
              <select
                className={SELECT_CLASS}
                value={config.aiModel}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    aiModel: e.target.value,
                  }))
                }
              >
                {AI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className={FIELDSET_LEGEND_CLASS}>
                <Columns size={14} aria-hidden="true" />
                Sessioni in parallelo
              </legend>
              <select
                className={SELECT_CLASS}
                value={String(config.maxParallelSessions)}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxParallelSessions: Number(e.target.value),
                  }))
                }
              >
                {PARALLEL_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </fieldset>
          </div>
        </div>

        {/* In modalità locale: scelta headed/headless al posto dei destinatari email
            (il report email non viene inviato) */}
        {localMode ? (
          <fieldset className="flex flex-col gap-3">
            <legend className={FIELDSET_LEGEND_CLASS}>
              <Monitor size={14} aria-hidden="true" />
              Modalità browser
            </legend>
            <select
              className={SELECT_CLASS}
              value={config.browserMode}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  browserMode: e.target.value as RunConfig['browserMode'],
                }))
              }
            >
              <option value="headed">Headed (browser visibile)</option>
              <option value="headless">Headless</option>
            </select>
          </fieldset>
        ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className={FIELDSET_LEGEND_CLASS}>
              <Mail size={14} aria-hidden="true" />
              Destinatari email
            </legend>
            <div
              className="border-grey focus-within:ring-primary/50 focus-within:border-primary flex min-h-11 flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 focus-within:ring-2"
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                input?.focus();
              }}
            >
              {(config.emailRecipients ?? []).map((email) => (
                <span
                  key={email}
                  className="bg-grey flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-black"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Rimuovi ${email}`}
                    className="text-dark-grey hover:bg-dark-grey/20 focus-visible:ring-primary/50 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:text-black focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => removeEmailRecipient(email)}
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                inputMode="email"
                className="placeholder:text-dark-grey min-w-40 flex-1 border-0 bg-transparent text-sm text-black focus:ring-0 focus:outline-none"
                placeholder={
                  (config.emailRecipients?.length ?? 0) === 0
                    ? 'es. team@azienda.com'
                    : 'Aggiungi altro…'
                }
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={handleEmailInputKeyDown}
                onBlur={() => {
                  if (emailInput.trim()) addEmailRecipient(emailInput);
                }}
              />
            </div>
            {emailError && (
              <p role="alert" className="text-xs text-red-600">
                {emailError}
              </p>
            )}
          </fieldset>
        )}
      </section>

      {/* Test E2E */}
      <section
        className={`${SECTION_CARD_CLASS} animate-fade-up`}
        style={{ animationDelay: '160ms' }}
      >
        <fieldset className="flex flex-col gap-4">
          <legend className={FIELDSET_LEGEND_CLASS}>
            <List size={14} aria-hidden="true" />
            Test E2E
          </legend>
          <label className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-black">
            <input
              type="checkbox"
              className={CHECKBOX_CLASS}
              checked={allTestsSelected}
              ref={(el) => {
                if (el) el.indeterminate = someTestsSelected;
              }}
              onChange={(e) => toggleAllTests(e.target.checked)}
            />
            Seleziona tutti
          </label>
          {validationErrors.tests && (
            <p role="alert" className="text-xs text-red-600">
              {validationErrors.tests}
            </p>
          )}
          {TESTS.map(({ id, label, description }) => {
            const selected = config.tests.some((t) => t.id === id);
            const notes = config.tests.find((t) => t.id === id)?.notes ?? '';
            return (
              <div
                key={id}
                className="border-grey bg-grey/40 hover:border-dark-grey/40 hover:bg-grey/70 flex flex-col gap-2 rounded-lg border px-4 py-3.5 transition-colors duration-200"
              >
                <label htmlFor={`test-${id}`} className="flex cursor-pointer items-start gap-3">
                  <input
                    id={`test-${id}`}
                    type="checkbox"
                    className={`${CHECKBOX_CLASS} mt-0.5`}
                    checked={selected}
                    onChange={(e) => toggleTest(id, e.target.checked)}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm leading-6 font-semibold text-black">{label}</span>
                    {description && (
                      <span className="text-dark-grey text-xs leading-5">{description}</span>
                    )}
                  </span>
                </label>
                {selected && (
                  <div className="text-dark-grey flex flex-col gap-1 pl-7 text-xs">
                    Eventuali note per l{"'"}agente AI (opzionale)
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows={3}
                      value={notes}
                      onChange={(e) => setTestNotes(id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      </section>

      <div className="animate-fade-up flex justify-center" style={{ animationDelay: '240ms' }}>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="bg-primary hover:bg-primary/85 focus-visible:ring-primary/50 flex cursor-pointer items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-semibold text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          <Play size={18} />
          <span>{state === 'loading' ? 'Avvio pipeline…' : 'Avvia test E2E'}</span>
        </button>
      </div>

      {state === 'success' && (
        <div
          role="status"
          className="shadow-card animate-fade-up flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
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
      {state === 'error' && (
        <div
          role="alert"
          className="shadow-card animate-fade-up flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <XCircle size={18} aria-hidden="true" className="shrink-0 text-red-600" />
          <span>
            Errore: la pipeline non è stata avviata.
            {errorMessage ? ` (${errorMessage})` : ''}
          </span>
        </div>
      )}
    </form>
  );
}

const CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 rounded border-dark-grey bg-white accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

const TEXTAREA_CLASS =
  'w-full rounded-md border border-grey bg-white px-3 py-2 text-sm text-black placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary';

const SELECT_CLASS =
  'select-chevron h-10 rounded-md border border-grey bg-white px-3 pr-10 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer';
