import { createJiti } from 'jiti';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseRunIndex, readRunIndexFile } from './run-index.mjs';

const jiti = createJiti(import.meta.url);
const { PATHS } = await jiti.import('../configs/index.ts');

// ============================================================================
// 1. CONFIGURAZIONE & VALIDAZIONE AMBIENTE
// ============================================================================
//
// La logica di flusso (chi riceve la mail e quando) NON vive qui: e' risolta
// una sola volta dal job "resolve_flow" in azure-pipelines.yml, che passa:
// - EMAIL_RECIPIENTS: destinatari gia' risolti (virgola-separati, formato
//   SendGrid), qualunque sia il flusso (PR, app, pipeline)
// - EMAIL_SEND_POLICY: "always" (invia sempre) | "on-fail" (invia solo se la
//   run non e' PASS: test falliti o test in errore)
// Questo script si occupa SOLO dell'invio.
//
// Esiti della run: PASS | FAIL (test falliti) | ERROR (test non giunti a esito).
// La mail parte SOLO per una run conclusa: nessun invio se la run non e' stata
// finalizzata o e' stata interrotta da un segnale (es. job cancellato a mano).

// Timeout e retry delle chiamate SendGrid (errori di rete, 429, 5xx)
const SENDGRID_TIMEOUT_MS = 30000;
const SENDGRID_MAX_ATTEMPTS = 3;

const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function getCleanEnv(key) {
  const val = process.env[key]?.trim();
  if (!val || val.startsWith('$(')) return '';
  return val;
}

function parseRecipients(mailTo) {
  return mailTo
    .split(',')
    .map((email) => ({ email: email.trim() }))
    .filter((item) => item.email && EMAIL_REGEX.test(item.email));
}

function parseFrom(value) {
  const named = /^(.*)<([^>]+)>$/.exec(value);
  const email = (named ? named[2] : value).trim().replace(/^["']|["']$/g, '');
  const name = named ? named[1].trim().replace(/^["']|["']$/g, '') : '';

  if (!EMAIL_REGEX.test(email)) {
    return null;
  }
  return name ? { email, name } : { email };
}

function loadConfig() {
  const apiKey = getCleanEnv('EMAIL_SENDGRID_API_KEY');
  const mailFromRaw = getCleanEnv('EMAIL_FROM');
  const mailToRaw = getCleanEnv('EMAIL_RECIPIENTS');
  const sendPolicy = getCleanEnv('EMAIL_SEND_POLICY') || 'on-fail';
  const reportUrl = getCleanEnv('EMAIL_REPORT_HTML_URL');
  const clientName = getCleanEnv('NEXT_PUBLIC_CLIENT_NAME');

  if (!apiKey) {
    return { disabled: true, reason: 'EMAIL_SENDGRID_API_KEY non configurata' };
  }

  if (!mailFromRaw) {
    throw new Error("EMAIL_FROM e' obbligatorio quando EMAIL_SENDGRID_API_KEY e' valorizzata.");
  }

  const from = parseFrom(mailFromRaw);
  if (!from) {
    throw new Error(
      `EMAIL_FROM non e' un indirizzo valido: "${mailFromRaw}". Usa una casella reale verificata su SendGrid.`,
    );
  }

  if (!reportUrl) {
    throw new Error(
      'EMAIL_REPORT_HTML_URL mancante. Caricare i report nello storage prima di eseguire il dispatch email.',
    );
  }

  if (sendPolicy !== 'always' && sendPolicy !== 'on-fail') {
    throw new Error(
      `EMAIL_SEND_POLICY non valida: "${sendPolicy}". Valori ammessi: always, on-fail.`,
    );
  }

  const to = parseRecipients(mailToRaw);

  return {
    disabled: false,
    apiKey,
    from,
    to,
    sendPolicy,
    reportUrl,
    clientName,
  };
}

// ============================================================================
// 2. MAIN & CLIENT SENDGRID
// ============================================================================

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[CONFIG ERROR] ${err.message}`);
    process.exit(1);
  }

  if (config.disabled) {
    console.log(`[mail] ${config.reason} — skip invio email.`);
    process.exit(0);
  }

  if (!config.to.length) {
    console.log('[mail] Nessun destinatario valido (EMAIL_RECIPIENTS vuota): skip invio email.');
    process.exit(0);
  }

  // La run corrente e' l'ultima generata da run-e2e.mjs nello step
  // "Run AI E2E" della pipeline: reports/{stamp}/{browser}/{viewport}/metadata.json
  const run = collectCurrentRun(PATHS.reports);
  if (!run) {
    console.log('[mail] Nessuna run conclusa (run assente o non finalizzata): skip invio email.');
    process.exit(0);
  }

  // Run interrotta da un segnale (job cancellato o agente arrestato): i test
  // non sono conclusi, nessuna mail.
  if (run.abortKind === 'aborted') {
    console.log(`[mail] Run ${run.run} interrotta (${run.abortReason}): skip invio email.`);
    process.exit(0);
  }

  // Policy di invio risolta dal job resolve_flow: "always" invia sempre,
  // "on-fail" solo se la run non e' PASS (FAIL o ERROR).
  if (config.sendPolicy === 'on-fail' && run.status === 'PASS') {
    console.log(`[mail] Run ${run.run} PASS e policy "on-fail": skip invio email.`);
    process.exit(0);
  }

  const subject = `[${config.clientName || 'E2E'}] Report E2E ${run.run} — ${subjectOutcome(run)}`;
  const textContent = buildText(run, config);
  const htmlContent = buildHtml(run, config);

  try {
    await sendSendgridEmail(config, subject, textContent, htmlContent);
    console.log(
      `[mail] Email inviata con successo (policy: ${config.sendPolicy}) a: ${config.to.map((item) => item.email).join(', ')}`,
    );
  } catch (err) {
    console.error(`[mail ERROR] ${err.message}`);
    process.exit(1);
  }
}

async function sendSendgridEmail(config, subject, text, html) {
  const body = JSON.stringify({
    personalizations: [{ to: config.to }],
    from: config.from,
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  });

  for (let attempt = 1; ; attempt++) {
    let retryable;
    let error;
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(SENDGRID_TIMEOUT_MS),
      });
      if (response.ok) return;
      const detail = await response.text();
      error = new Error(`SendGrid API HTTP ${response.status}: ${detail}`);
      retryable = response.status === 429 || response.status >= 500;
    } catch (err) {
      // Timeout o errore di rete
      error = new Error(`SendGrid non raggiungibile: ${err.message}`);
      retryable = true;
    }

    if (!retryable || attempt >= SENDGRID_MAX_ATTEMPTS) throw error;
    console.warn(
      `[mail] Tentativo ${attempt}/${SENDGRID_MAX_ATTEMPTS} fallito (${error.message}), retry...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

// ============================================================================
// 3. ESTRAZIONE DATI DELLA RUN CORRENTE
// ============================================================================

// Layout prodotto dalla pipeline (step "Run AI E2E"):
//   reports/index.json                                   (index aggregato, dal piu' recente)
//   reports/{stamp}/{browser}/{viewport}/metadata.json   (session-level)
//
// La run corrente viene letta da index.json (un solo file, primo record = run
// piu' recente, gia' con totali ed environments aggregati da run-e2e-ci.mjs).
// Fallback: scansione delle cartelle se index.json e' assente o vuoto.
function collectCurrentRun(reportsDir) {
  if (!existsSync(reportsDir)) return null;

  const latest = findLatestRun(reportsDir);
  if (!latest) return null;
  const { stamp, environments } = latest;
  const runPath = join(reportsDir, stamp);
  // In pipeline su disco c'e' solo la cartella della run corrente (l'index
  // invece, dopo l'upload, contiene tutto lo storico): se la cartella manca,
  // il primo record dell'index e' una run precedente, non quella corrente.
  if (!existsSync(runPath)) return null;
  const runMeta = readJsonFile(join(runPath, 'metadata.json'));

  // Sessioni da leggere: quelle dichiarate nell'index (o tutte, nel fallback)
  const combos = environments.length ? environments : listSessionCombos(runPath);

  const sessions = [];
  for (const { browser, viewport } of combos) {
    const metaPath = join(runPath, browser, viewport, 'metadata.json');
    if (!existsSync(metaPath)) continue;

    try {
      const data = JSON.parse(readFileSync(metaPath, 'utf8'));
      const bugs = data.bugs ?? {};
      const tests = (data.tests ?? []).map((t) => ({
        label: t.name ?? t.id ?? 'Test',
        status: normalizeStatus(t.status),
        errorType: t.errorType ?? '',
        // Motivi molto lunghi (es. body JSON di errore OpenRouter) troncati:
        // il dettaglio completo e' nel report della dashboard
        reason: truncateText(t.reason ?? '', 300),
      }));
      const pass = tests.filter((t) => t.status === 'PASS').length;
      const fail = tests.filter((t) => t.status === 'FAIL').length;
      const error = tests.filter((t) => t.status === 'ERROR').length;

      sessions.push({
        browser: data.browser ?? browser,
        viewport: data.viewport ?? viewport,
        status: normalizeStatus(data.status),
        stats: {
          pass,
          fail,
          error,
          total: tests.length,
          passRate: tests.length ? Math.round((pass / tests.length) * 100) : 0,
          high: Number(bugs.high) || 0,
          medium: Number(bugs.medium) || 0,
          low: Number(bugs.low) || 0,
          duration: data.duration ?? '',
        },
        tests,
      });
    } catch (err) {
      console.error(`[mail] File JSON non valido ${metaPath}: ${err.message} — ignorato.`);
    }
  }

  // Run senza metadata di sessione: non finalizzata
  if (!sessions.length) return null;

  const totals = sessions.reduce(
    (acc, s) => ({
      pass: acc.pass + s.stats.pass,
      fail: acc.fail + s.stats.fail,
      error: acc.error + s.stats.error,
      total: acc.total + s.stats.total,
      high: acc.high + s.stats.high,
      medium: acc.medium + s.stats.medium,
      low: acc.low + s.stats.low,
    }),
    { pass: 0, fail: 0, error: 0, total: 0, high: 0, medium: 0, low: 0 },
  );

  // Esito: il piu' grave tra quello scritto dalla pipeline (metadata di run) e
  // quello derivato dalle sessioni (le run legacy marcavano FAIL anche i test
  // in ERROR).
  const derived = sessions.some((s) => s.status === 'ERROR' || s.stats.error > 0)
    ? 'ERROR'
    : sessions.some((s) => s.status === 'FAIL')
      ? 'FAIL'
      : 'PASS';
  const severity = ['PASS', 'FAIL', 'ERROR'];
  const status = severity.includes(runMeta?.status)
    ? severity[Math.max(severity.indexOf(runMeta.status), severity.indexOf(derived))]
    : derived;

  return {
    run: stamp,
    status,
    abortKind: runMeta?.abort?.kind ?? '',
    abortReason: runMeta?.abort?.reason ?? '',
    date: formatStamp(stamp),
    sessions,
    totals,
  };
}

/** Status di test/sessione: PASS | FAIL | ERROR (sconosciuto -> ERROR, mai PASS). */
function normalizeStatus(status) {
  return status === 'PASS' || status === 'FAIL' ? status : 'ERROR';
}

function truncateText(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatStamp(stamp) {
  return `${stamp.slice(0, 10)} ${stamp.slice(11).replace(/-/g, ':')}`;
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Esito per l'oggetto della mail: PASS, FAIL (n falliti), INCOMPLETA (n errori). */
function subjectOutcome(run) {
  if (run.status === 'PASS') return 'PASS';
  if (run.status === 'ERROR') {
    return `INCOMPLETA (${run.totals.error} ${run.totals.error === 1 ? 'errore' : 'errori'}${run.totals.fail ? `, ${run.totals.fail} falliti` : ''})`;
  }
  return `FAIL (${run.totals.fail} ${run.totals.fail === 1 ? 'fallito' : 'falliti'})`;
}

/**
 * Trova la run piu' recente. Preferisce index.json (scritto da run-e2e-ci.mjs
 * allo step "Run AI E2E", ordinato dal piu' recente): basta leggere il primo
 * record invece di scansionare le cartelle. Fallback: ultima cartella {stamp}.
 */
function findLatestRun(reportsDir) {
  const entries = parseRunIndex(readRunIndexFile(reportsDir));
  const fromIndex = entries.find((e) => e?.run);
  if (fromIndex) {
    return { stamp: fromIndex.run, environments: fromIndex.environments ?? [] };
  }

  // Cartelle run: stamp UTC con trattini (es. 2026-10-21_06-01-51)
  const stamps = readdirSync(reportsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(name))
    .filter((name) => statSync(join(reportsDir, name)).isDirectory())
    .sort();
  if (!stamps.length) return null;

  return { stamp: stamps.at(-1), environments: [] };
}

// Fallback: elenca le combinazioni browser/viewport presenti su disco
function listSessionCombos(runPath) {
  const combos = [];
  if (!existsSync(runPath)) return combos;

  for (const browser of readdirSync(runPath).sort()) {
    const browserPath = join(runPath, browser);
    if (!statSync(browserPath).isDirectory()) continue;
    for (const viewport of readdirSync(browserPath).sort()) {
      if (statSync(join(browserPath, viewport)).isDirectory()) {
        combos.push({ browser, viewport });
      }
    }
  }
  return combos;
}

// ============================================================================
// 4. TEMPLATE EMAIL (TEXT & HTML) — stile minimale allineato all'app
// ============================================================================

const OUTCOME_LABEL = {
  PASS: 'Superata',
  FAIL: 'Fallita',
  ERROR: 'Incompleta',
};

/** Riga riassuntiva dei conteggi (test superati, falliti, in errore). */
function totalsLine(stats) {
  const parts = [`${stats.pass}/${stats.total} test superati`];
  if (stats.fail) parts.push(`${stats.fail} falliti`);
  if (stats.error) parts.push(`${stats.error} in errore`);
  return parts.join(' · ');
}

function buildText(run, config) {
  const reportLink = buildReportLink(config, run);
  const lines = [
    `Report E2E ${config.clientName ? config.clientName + ' ' : ''}— run ${run.run}`,
    `Esito: ${run.status} (${OUTCOME_LABEL[run.status] ?? run.status})`,
    `Test: ${totalsLine(run.totals)} · Bug H/M/L: ${run.totals.high}/${run.totals.medium}/${run.totals.low}`,
  ];
  if (run.abortReason) lines.push(`Run interrotta: ${run.abortReason}`);
  lines.push('');
  for (const s of run.sessions) {
    lines.push(
      `${s.browser.toUpperCase()} ${s.viewport}: ${s.status} — ${totalsLine(s.stats)}, bug H/M/L: ${s.stats.high}/${s.stats.medium}/${s.stats.low}`,
    );
    for (const t of s.tests) {
      lines.push(`  - ${t.label}: ${t.status}`);
      if (t.status !== 'PASS' && t.reason) {
        lines.push(`      ${t.errorType ? `[${t.errorType}] ` : ''}${t.reason}`);
      }
    }
  }
  lines.push('', 'Apri il report HTML:', reportLink);
  return lines.join('\n');
}

// Il reportUrl e' la base dell'app (es. https://ac-milan-ai-e2e.vercel.app):
// il link deve puntare alla rotta del report della run corrente
// (/reports/{runId}, vedi src/app/reports/[runId]/page.tsx).
function buildReportLink(config, run) {
  return `${config.reportUrl.replace(/\/+$/, '')}/reports/${run.run}`;
}

// Palette allineata all'app (globals.scss):
// primary #2a2a2a · grey #ededed · dark-grey #2a2a2a · bianco. Verde/rosso/arancio solo per esito.
const C = {
  primary: '#2a2a2a',
  grey: '#ededed',
  muted: '#8a8a8a',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  red: '#dc2626',
  redBg: '#fef2f2',
  orange: '#c2410c',
  orangeBg: '#fff7ed',
  border: '#ededed',
};

/** Colori (testo, sfondo) per esito: ERROR in arancio, distinto dal rosso del FAIL. */
function statusColors(status) {
  if (status === 'PASS') return { fg: C.green, bg: C.greenBg };
  if (status === 'FAIL') return { fg: C.red, bg: C.redBg };
  return { fg: C.orange, bg: C.orangeBg };
}

function chip(status, size = 11) {
  const { fg, bg } = statusColors(status);
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:${size}px;font-weight:700;background:${bg};color:${fg};">${escapeHtml(status)}</span>`;
}

function buildHtml(run, config) {
  const reportLink = buildReportLink(config, run);
  const { fg: accent, bg: accentBg } = statusColors(run.status);
  const statusLabel = OUTCOME_LABEL[run.status] ?? run.status;

  const sessionBlocks = run.sessions
    .map((s) => {
      const testRows = s.tests.length
        ? s.tests
            .map((t) => {
              const reason =
                t.status !== 'PASS' && t.reason
                  ? `<div style="margin-top:3px;font-size:12px;color:${statusColors(t.status).fg};">${t.errorType ? `<code style="font-family:monospace;">${escapeHtml(t.errorType)}</code> · ` : ''}${escapeHtml(t.reason)}</div>`
                  : '';
              return `<tr>
            <td style="padding:7px 12px;border-top:1px solid ${C.border};font-size:13px;color:${C.primary};">${escapeHtml(t.label)}${reason}</td>
            <td style="padding:7px 12px;border-top:1px solid ${C.border};text-align:right;vertical-align:top;">
              ${chip(t.status)}
            </td>
          </tr>`;
            })
            .join('')
        : '';

      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid ${C.border};border-radius:12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td style="padding:14px 16px 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;font-size:15px;font-weight:700;color:${C.primary};text-transform:capitalize;">${escapeHtml(s.browser)} <span style="font-weight:400;color:${C.muted};">· ${escapeHtml(s.viewport)}</span></p>
              <p style="margin:2px 0 0;font-size:12px;color:${C.muted};">${s.stats.total ? escapeHtml(totalsLine(s.stats)) : 'Nessun test'}${s.stats.duration ? ` · ${escapeHtml(s.stats.duration)}` : ''}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              ${chip(s.status)}
            </td>
          </tr></table>
        </td>
      </tr>
      ${
        testRows
          ? `<tr><td style="padding:0 16px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
          ${testRows}
        </table>
      </td></tr>`
          : ''
      }
    </table>`;
    })
    .join('\n');

  const notices = [
    run.abortReason ? `Run interrotta: ${run.abortReason}` : '',
    run.status === 'ERROR' && !run.abortReason
      ? `${run.totals.error} test non sono giunti a esito: il motivo è indicato sotto ogni test.`
      : '',
  ].filter(Boolean);
  const noticeBlock = notices.length
    ? `<tr><td style="padding:0 4px 16px;">
          <p style="margin:0;padding:12px 16px;border-radius:12px;background:${C.orangeBg};color:${C.orange};font-size:13px;font-weight:600;">${notices.map(escapeHtml).join('<br>')}</p>
        </td></tr>`
    : '';

  const summaryRow = `<tr><td style="padding:0 4px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${accentBg};border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:#ffffff;color:${accent};">${escapeHtml(statusLabel)}</span>
              </td>
              <td style="padding:16px 18px;text-align:right;font-size:13px;color:${C.primary};white-space:nowrap;">
                <strong>${run.totals.pass}/${run.totals.total}</strong> test superati${run.totals.error ? ` &nbsp;·&nbsp; <strong style="color:${C.orange};">${run.totals.error}</strong> in errore` : ''}
                &nbsp;·&nbsp; Bug <strong>${run.totals.high}</strong> H / <strong>${run.totals.medium}</strong> M / <strong>${run.totals.low}</strong> L
              </td>
            </tr>
          </table>
        </td></tr>`;

  return layoutHtml(
    config,
    run.run,
    `${noticeBlock}${summaryRow}
        <tr><td style="padding:0 4px;">
          ${sessionBlocks}
        </td></tr>
        ${ctaRow(reportLink, 'Apri il report completo →')}`,
  );
}

function ctaRow(href, label) {
  return `<tr><td align="center" style="padding:12px 4px 24px;">
          <a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 28px;background:${C.primary};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>
        </td></tr>`;
}

/** Struttura comune della mail: intestazione, corpo e footer. */
function layoutHtml(config, runId, body) {
  const brand = config.clientName
    ? `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};">${escapeHtml(config.clientName)}</p>`
    : '';
  const runLine = runId
    ? `<p style="margin:4px 0 0;font-size:13px;color:${C.muted};">Run <span style="font-family:monospace;">${escapeHtml(runId)}</span></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 4px 20px;">
          ${brand}
          <h1 style="margin:0;font-size:22px;font-weight:700;color:${C.primary};">Report E2E</h1>
          ${runLine}
        </td></tr>

        ${body}

        <tr><td align="center" style="border-top:1px solid ${C.border};padding:16px 4px 0;font-size:11px;color:${C.muted};">
          Email automatica dalla pipeline E2E${config.clientName ? ` — ${escapeHtml(config.clientName)}` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// 5. HELPER DI SANITIZZAZIONE
// ============================================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

// Avvio
await main();
