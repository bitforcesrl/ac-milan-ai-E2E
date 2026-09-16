const apiKey = process.env.SENDGRID_API_KEY?.trim();
const mailFrom = process.env.MAIL_FROM?.trim();
const mailTo = process.env.MAIL_TO?.trim();
const reportUrl = process.env.REPORT_HTML_URL?.trim();

if (!apiKey || apiKey.startsWith('$(')) {
  console.log('SENDGRID_API_KEY not set — skip email.');
  process.exit(0);
}

if (!mailFrom || !mailTo || mailFrom.startsWith('$(') || mailTo.startsWith('$(')) {
  console.error('MAIL_FROM and MAIL_TO are required when SENDGRID_API_KEY is set.');
  process.exit(1);
}

const from = parseFrom(mailFrom);
if (!from) {
  console.error(`MAIL_FROM non e' un indirizzo valido: "${mailFrom}"`);
  console.error('Usa UNA casella reale verificata in SendGrid (es. noreply@azienda.com).');
  console.error('I gruppi mail / DL vanno in MAIL_TO, non in MAIL_FROM.');
  process.exit(1);
}

if (!reportUrl || reportUrl.startsWith('$(')) {
  console.error('REPORT_HTML_URL is missing. Upload the reports to blob storage first.');
  process.exit(1);
}

const to = mailTo.split(',').map((email) => ({ email: email.trim() })).filter((item) => item.email);
const date = new Date().toISOString().slice(0, 10);
const text = `Report E2E AC Milan (${date})\n\nApri il report HTML:\n${reportUrl}\n`;
const html = `<p>Report E2E AC Milan (${escapeHtml(date)})</p>
<p><a href="${escapeAttr(reportUrl)}">Apri il report HTML</a></p>`;

const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to }],
    from,
    subject: `[AC Milan E2E] ${date}`,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  }),
});

if (!response.ok) {
  const detail = await response.text();
  console.error(`SendGrid ${response.status}: ${detail}`);
  process.exit(1);
}

console.log(`Email sent to ${to.map((item) => item.email).join(', ')}`);

function parseFrom(value) {
  const named = /^(.*)<([^>]+)>$/.exec(value);
  const email = (named ? named[2] : value).trim().replace(/^["']|["']$/g, '');
  const name = named ? named[1].trim().replace(/^["']|["']$/g, '') : '';
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
    return null;
  }
  return name ? { email, name } : { email };
}

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
