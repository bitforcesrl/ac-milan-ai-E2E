import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { PATHS } = await jiti.import('../configs/index.ts');
import { parseRunIndex, readRunIndexFile } from './run-index.mjs';

// ============================================================================
// 1. CONFIGURAZIONE & VALIDAZIONE AMBIENTE
// ============================================================================

function getCleanEnv(key) {
  const val = process.env[key]?.trim();
  if (!val || val.startsWith('$(')) return '';
  return val;
}

function parseRecipients(mailTo) {
  return mailTo
    .split(',')
    .map((email) => ({ email: email.trim() }))
    .filter((item) => item.email);
}

function parseFrom(value) {
  const named = /^(.*)<([^>]+)>$/.exec(value);
  const email = (named ? named[2] : value).trim().replace(/^["']|["']$/g, '');
  const name = named ? named[1].trim().replace(/^["']|["']$/g, '') : '';

  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
    return null;
  }
  return name ? { email, name } : { email };
}

function loadConfig() {
  const apiKey = getCleanEnv('EMAIL_SENDGRID_API_KEY');
  const mailFromRaw = getCleanEnv('EMAIL_FROM');
  const mailToRaw = getCleanEnv('EMAIL_TO');
  const reportUrl = getCleanEnv('EMAIL_REPORT_HTML_URL');
  const clientName = getCleanEnv('NEXT_PUBLIC_CLIENT_NAME');

  if (!apiKey) {
    return { disabled: true, reason: 'EMAIL_SENDGRID_API_KEY non configurata' };
  }

  if (!mailFromRaw || !mailToRaw) {
    throw new Error('EMAIL_FROM e EMAIL_TO sono obbligatori quando EMAIL_SENDGRID_API_KEY e\' valorizzata.');
  }

  const from = parseFrom(mailFromRaw);
  if (!from) {
    throw new Error(
      `EMAIL_FROM non e' un indirizzo valido: "${mailFromRaw}". Usa una casella reale verificata su SendGrid.`
    );
  }

  if (!reportUrl) {
    throw new Error('EMAIL_REPORT_HTML_URL mancante. Caricare i report nello storage prima di eseguire il dispatch email.');
  }

  return {
    disabled: false,
    apiKey,
    from,
    to: parseRecipients(mailToRaw),
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

  // La run corrente e' l'ultima generata da run-e2e-ci.mjs nello step
  // "Run AI E2E" della pipeline: reports/{stamp}/{browser}/{viewport}/metadata.json
  const run = collectCurrentRun(PATHS.reports);
  if (!run) {
    console.log('[mail] Nessuna run trovata: skip invio email.');
    process.exit(0);
  }

  const subject = `[${config.clientName || 'E2E'}] Report E2E ${run.run} — ${run.status === 'FAIL' ? 'FAIL' : 'PASS'}`;
  const textContent = buildText(run, config);
  const htmlContent = buildHtml(run, config);

  try {
    await sendSendgridEmail(config, subject, textContent, htmlContent);
    console.log(`[mail] Email inviata con successo a: ${config.to.map((item) => item.email).join(', ')}`);
  } catch (err) {
    console.error(`[mail ERROR] ${err.message}`);
    process.exit(1);
  }
}

async function sendSendgridEmail(config, subject, text, html) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: config.to }],
      from: config.from,
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SendGrid API HTTP ${response.status}: ${detail}`);
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

  // Sessioni da leggere: quelle dichiarate nell'index (o tutte, nel fallback)
  const combos = environments.length
    ? environments
    : listSessionCombos(runPath);

  const sessions = [];
  for (const { browser, viewport } of combos) {
    const metaPath = join(runPath, browser, viewport, 'metadata.json');
    if (!existsSync(metaPath)) continue;

    try {
      const data = JSON.parse(readFileSync(metaPath, 'utf8'));
      const bugs = data.bugs ?? {};
      const tests = (data.tests ?? []).map((t) => ({
        label: t.name ?? t.id ?? 'Test',
        status: t.status === 'FAIL' ? 'FAIL' : 'PASS',
      }));
      const pass = tests.filter((t) => t.status === 'PASS').length;

      sessions.push({
        browser: data.browser ?? browser,
        viewport: data.viewport ?? viewport,
        status: data.status === 'FAIL' ? 'FAIL' : 'PASS',
        stats: {
          pass,
          fail: tests.length - pass,
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

  if (!sessions.length) return null;

  const totals = sessions.reduce(
    (acc, s) => ({
      pass: acc.pass + s.stats.pass,
      fail: acc.fail + s.stats.fail,
      total: acc.total + s.stats.total,
      high: acc.high + s.stats.high,
      medium: acc.medium + s.stats.medium,
      low: acc.low + s.stats.low,
    }),
    { pass: 0, fail: 0, total: 0, high: 0, medium: 0, low: 0 }
  );

  return {
    run: stamp,
    status: sessions.some((s) => s.status === 'FAIL') ? 'FAIL' : 'PASS',
    date: `${stamp.slice(0, 10)} ${stamp.slice(11).replace(/-/g, ':')}`,
    sessions,
    totals,
  };
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

  const stamps = readdirSync(reportsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/.test(name))
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

function buildText(run, config) {
  const lines = [
    `Report E2E ${config.clientName ? config.clientName + ' ' : ''}— run ${run.run}`,
    `Esito: ${run.status}`,
    `Test: ${run.totals.pass}/${run.totals.total} superati · Bug H/M/L: ${run.totals.high}/${run.totals.medium}/${run.totals.low}`,
    '',
  ];
  for (const s of run.sessions) {
    lines.push(
      `${s.browser.toUpperCase()} ${s.viewport}: ${s.status} — ${s.stats.pass}/${s.stats.total} test superati, bug H/M/L: ${s.stats.high}/${s.stats.medium}/${s.stats.low}`
    );
    for (const t of s.tests) {
      lines.push(`  - ${t.label}: ${t.status}`);
    }
  }
  lines.push('', 'Apri il report HTML:', config.reportUrl);
  return lines.join('\n');
}

// Palette allineata all'app (globals.scss):
// primary #2a2a2a · grey #ededed · dark-grey #2a2a2a · bianco. Verde/rosso solo per esito.
const C = {
  primary: '#2a2a2a',
  grey: '#ededed',
  muted: '#8a8a8a',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  red: '#dc2626',
  redBg: '#fef2f2',
  border: '#ededed',
};

function buildHtml(run, config) {
  const fail = run.status === 'FAIL';
  const accent = fail ? C.red : C.green;
  const accentBg = fail ? C.redBg : C.greenBg;
  const statusLabel = fail ? 'Fallita' : 'Superata';

  const brand = config.clientName
    ? `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};">${escapeHtml(config.clientName)}</p>`
    : '';

  const sessionBlocks = run.sessions
    .map((s) => {
      const sFail = s.status === 'FAIL';
      const chipBg = sFail ? C.redBg : C.greenBg;
      const chipColor = sFail ? C.red : C.green;

      const testRows = s.tests.length
        ? s.tests
            .map(
              (t) => `<tr>
            <td style="padding:7px 12px;border-top:1px solid ${C.border};font-size:13px;color:${C.primary};">${escapeHtml(t.label)}</td>
            <td style="padding:7px 12px;border-top:1px solid ${C.border};text-align:right;">
              <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${t.status === 'FAIL' ? C.redBg : C.greenBg};color:${t.status === 'FAIL' ? C.red : C.green};">${t.status}</span>
            </td>
          </tr>`
            )
            .join('')
        : '';

      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid ${C.border};border-radius:12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td style="padding:14px 16px 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;font-size:15px;font-weight:700;color:${C.primary};text-transform:capitalize;">${escapeHtml(s.browser)} <span style="font-weight:400;color:${C.muted};">· ${escapeHtml(s.viewport)}</span></p>
              <p style="margin:2px 0 0;font-size:12px;color:${C.muted};">${s.stats.total ? `${s.stats.pass}/${s.stats.total} test superati` : 'Nessun test'}${s.stats.duration ? ` · ${escapeHtml(s.stats.duration)}` : ''}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${chipBg};color:${chipColor};">${s.status}</span>
            </td>
          </tr></table>
        </td>
      </tr>
      ${testRows ? `<tr><td style="padding:0 16px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
          ${testRows}
        </table>
      </td></tr>` : ''}
    </table>`;
    })
    .join('\n');

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
          <p style="margin:4px 0 0;font-size:13px;color:${C.muted};">Run <span style="font-family:monospace;">${escapeHtml(run.run)}</span></p>
        </td></tr>

        <tr><td style="padding:0 4px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${accentBg};border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:#ffffff;color:${accent};">${statusLabel}</span>
              </td>
              <td style="padding:16px 18px;text-align:right;font-size:13px;color:${C.primary};white-space:nowrap;">
                <strong>${run.totals.pass}/${run.totals.total}</strong> test superati
                &nbsp;·&nbsp; Bug <strong>${run.totals.high}</strong> H / <strong>${run.totals.medium}</strong> M / <strong>${run.totals.low}</strong> L
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 4px;">
          ${sessionBlocks}
        </td></tr>

        <tr><td align="center" style="padding:12px 4px 24px;">
          <a href="${escapeAttr(config.reportUrl)}" style="display:inline-block;padding:12px 28px;background:${C.primary};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">Apri il report completo →</a>
        </td></tr>

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
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", String.fromCharCode(39));
}

// Avvio
await main();
