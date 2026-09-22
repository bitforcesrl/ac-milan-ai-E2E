import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PATHS } = require('../config.js');

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
  const clientName = getCleanEnv('EMAIL_CLIENT_NAME');

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

  const runs = collectRuns(PATHS.raw);
  const date = latestRunDate(runs);
  const subject = `[${config.clientName || 'E2E'}] Report E2E ${date} — ${overallLabel(runs)}`;
  const textContent = buildText(runs, date, config);
  const htmlContent = buildHtml(runs, date, config);

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
// 3. ESTRAZIONE E RACCOLTA DATI (RUNS)
// ============================================================================

// Nuovo layout: reports/{yyyy-MM-dd_hh:mm:ss}/{browser-viewport}/metadata.json
function collectRuns(reportsDir) {
  if (!existsSync(reportsDir)) return [];

  const runs = [];
  for (const runDir of readdirSync(reportsDir).sort()) {
    const runPath = join(reportsDir, runDir);
    if (!statSync(runPath).isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/.test(runDir)) continue;

    for (const sessionDir of readdirSync(runPath).sort()) {
      const sessionPath = join(runPath, sessionDir);
      if (!statSync(sessionPath).isDirectory()) continue;

      const metaPath = join(sessionPath, 'metadata.json');
      if (!existsSync(metaPath)) continue;

      try {
        const data = JSON.parse(readFileSync(metaPath, 'utf8'));
        const tests = (data.tests ?? []).map((t) => ({
          label: t.name ?? 'Test',
          status: t.status === 'FAIL' ? 'FAIL' : 'PASS',
        }));
        const pass = tests.filter((t) => t.status === 'PASS').length;
        const fail = tests.length - pass;
        const bugs = data.bugs ?? {};

        runs.push({
          run: runDir,
          browser: sessionDir,
          status: data.status === 'FAIL' ? 'FAIL' : data.status === 'PASS' ? 'PASS' : '',
          stats: {
            pass,
            fail,
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
  }

  return runs;
}

function latestRunDate(runs) {
  const latest = runs.map((r) => r.run).sort().at(-1);
  const fromRun = /^(\d{4}-\d{2}-\d{2})_/.exec(latest ?? '');
  return fromRun ? fromRun[1] : new Date().toISOString().slice(0, 10);
}

function overallLabel(runs) {
  if (!runs.length) return 'Nessun report';
  return runs.some((r) => r.status === 'FAIL') ? '❌ FAIL' : '✅ PASS';
}

// ============================================================================
// 4. TEMPLATE EMAIL (TEXT & HTML)
// ============================================================================

function buildText(runs, date, config) {
  const lines = [`Report E2E ${config.clientName ? config.clientName + ' ' : ''}(${date})`, ''];
  for (const run of runs) {
    lines.push(
      `${run.browser.toUpperCase()}: ${run.status || 'N/D'} — ${run.stats.pass}/${run.stats.total} test superati, bug H/M/L: ${run.stats.high}/${run.stats.medium}/${run.stats.low}`
    );
    for (const t of run.tests) {
      lines.push(`  - ${t.label}: ${t.status}`);
    }
  }
  lines.push('', 'Apri il report HTML:', config.reportUrl);
  return lines.join('\n');
}

function buildHtml(runs, date, config) {
  const anyFail = runs.some((r) => r.status === 'FAIL');
  const bannerBg = anyFail ? '#fee2e2' : '#dcfce7';
  const bannerColor = anyFail ? '#b91c1c' : '#15803d';
  const bannerBorder = anyFail ? '#ef4444' : '#22c55e';
  const bannerText = anyFail ? '❌ Run fallita — verificare gli errori' : '✅ Run superata con successo';

  const brand = config.clientName
    ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(config.clientName)}</p>`
    : '';

  const sections = runs
    .map((run) => {
      const s = run.stats;
      const fail = run.status === 'FAIL';
      const accent = fail ? '#ef4444' : '#22c55e';
      const chipBg = fail ? '#fee2e2' : '#dcfce7';
      const chipColor = fail ? '#b91c1c' : '#15803d';

      const testRows = run.tests.length
        ? run.tests
            .map(
              (t) => `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(t.label)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${t.status === 'FAIL' ? '#fee2e2' : '#dcfce7'};color:${t.status === 'FAIL' ? '#b91c1c' : '#15803d'};">${t.status}</span>
            </td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="2" style="padding:6px 12px;font-size:13px;color:#64748b;">Dettaglio test non disponibile nel summary.</td></tr>`;

      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;border-top:4px solid ${accent};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td style="padding:16px 16px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;text-transform:capitalize;">${escapeHtml(run.browser)}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${escapeHtml(date)}${s.duration ? ` · ⏱️ ${escapeHtml(s.duration)}` : ''}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:${chipBg};color:${chipColor};">${run.status || 'N/D'}</span>
            </td>
          </tr></table>
        </td>
      </tr>
      ${
        s.total
          ? `<tr><td style="padding:8px 16px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#f1f5f9;border-radius:999px;height:8px;line-height:8px;">
            <div style="width:${s.passRate}\%;background:${accent};height:8px;line-height:8px;border-radius:999px;font-size:1px;">&nbsp;</div>
          </td>
          <td style="padding-left:10px;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">${s.passRate}% (${s.pass}/${s.total})</td>
        </tr></table>
      </td></tr>`
          : ''
      }
      <tr><td style="padding:12px 16px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;color:#64748b;">
          <tr>
            <td style="padding:4px 0;"><span style="color:#16a34a;font-weight:700;">${s.pass}</span> superati</td>
            <td style="padding:4px 0;"><span style="color:#dc2626;font-weight:700;">${s.fail}</span> falliti</td>
            <td style="padding:4px 0;">Bug H: <span style="color:${s.high ? '#dc2626' : 'inherit'};font-weight:700;">${s.high}</span></td>
            <td style="padding:4px 0;">M: <span style="color:${s.medium ? '#d97706' : 'inherit'};font-weight:700;">${s.medium}</span></td>
            <td style="padding:4px 0;">L: <span style="font-weight:700;">${s.low}</span></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:4px 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border-radius:8px;">
          ${testRows}
        </table>
      </td></tr>
    </table>`;
    })
    .join('\n');

  const body = sections || `<p style="font-size:14px;color:#64748b;">Nessun report di summary trovato in questa run.</p>`;

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
        <tr><td style="padding:0 4px 16px;">
          ${brand}
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">Report E2E</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${escapeHtml(date)} — Resoconto esecuzione pipeline</p>
        </td></tr>
        <tr><td style="padding:0 4px 20px;">
          <div style="padding:14px 18px;border-radius:8px;background:${bannerBg};color:${bannerColor};border-left:4px solid ${bannerBorder};font-weight:600;font-size:15px;">${bannerText}</div>
        </td></tr>
        <tr><td>
          ${body}
        </td></tr>
        <tr><td align="center" style="padding:8px 4px 24px;">
          <a href="${escapeAttr(config.reportUrl)}" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Apri il report HTML completo →</a>
        </td></tr>
        <tr><td align="center" style="font-size:11px;color:#94a3b8;">
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