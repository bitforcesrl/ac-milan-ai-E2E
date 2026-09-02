import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiKey = process.env.SENDGRID_API_KEY?.trim();
const mailFrom = process.env.MAIL_FROM?.trim();
const mailTo = process.env.MAIL_TO?.trim();

if (!apiKey || apiKey.startsWith('$(')) {
  console.log('SENDGRID_API_KEY not set — skip email.');
  process.exit(0);
}

if (!mailFrom || !mailTo || mailFrom.startsWith('$(') || mailTo.startsWith('$(')) {
  console.error('MAIL_FROM and MAIL_TO are required when SENDGRID_API_KEY is set.');
  process.exit(1);
}

const reportsDir = 'reports';
const archive = 'e2e-reports.tgz';
const markdownFiles = existsSync(reportsDir) ? listMarkdown(reportsDir) : [];
const summaryPath = markdownFiles.find((file) => file.replaceAll('\\', '/').endsWith('ci-summary.md'));
const body = buildBody(summaryPath, markdownFiles);

if (existsSync(reportsDir)) {
  execFileSync('tar', ['-czf', archive, reportsDir], { stdio: 'inherit' });
}

const attachments = [];
if (existsSync(archive)) {
  attachments.push({
    content: readFileSync(archive).toString('base64'),
    filename: archive,
    type: 'application/gzip',
    disposition: 'attachment',
  });
}

const to = mailTo.split(',').map((email) => ({ email: email.trim() })).filter((item) => item.email);
const date = new Date().toISOString().slice(0, 10);

const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to }],
    from: { email: mailFrom },
    subject: `[AC Milan E2E] ${date}`,
    content: [{ type: 'text/plain', value: body }],
    attachments: attachments.length ? attachments : undefined,
  }),
});

if (!response.ok) {
  const detail = await response.text();
  console.error(`SendGrid ${response.status}: ${detail}`);
  process.exit(1);
}

console.log(`Email sent to ${to.map((item) => item.email).join(', ')}`);

function listMarkdown(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listMarkdown(full));
    } else if (entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

function buildBody(summaryPath, files) {
  if (summaryPath && existsSync(summaryPath)) {
    return readFileSync(summaryPath, 'utf8');
  }

  if (!files.length) {
    return 'Nessun report generato. Controlla i log della pipeline Azure.';
  }

  return files
    .map((file) => `## ${relative(process.cwd(), file)}\n\n${readFileSync(file, 'utf8')}`)
    .join('\n\n---\n\n');
}
