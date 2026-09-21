import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, posix, relative } from 'node:path';
import { getStorageContext } from './azure-blob.mjs';
import { PATHS } from '../config.js';

// Carica i report HTML (reports/html/) su Azure Blob nel path FISSO <prefix>/:
// ogni run si accumula nello stesso path, lo storico è permanente.
// L'index.html con lo storico completo è già stato generato da render-reports.mjs
// (dopo che sync-history.mjs ha scaricato le run precedenti).

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip blob upload.');
  process.exit(0);
}

if (!existsSync(PATHS.html)) {
  console.log(`No ${PATHS.html}/ folder — skip blob upload.`);
  process.exit(0);
}

const files = listFiles(PATHS.html);
if (!files.length) {
  console.log(`No files in ${PATHS.html}/ — skip blob upload.`);
  process.exit(0);
}

const blobBase = `${ctx.container.url.replace(/\/$/, '')}/${ctx.prefix}`;

for (const filePath of files) {
  const rel = relative(PATHS.html, filePath).replaceAll('\\', '/');
  const blobName = `${ctx.prefix}/${rel}`;
  const blob = ctx.container.getBlockBlobClient(blobName);
  const contentType = contentTypeFor(filePath);
  const options = { blobHTTPHeaders: { blobContentType: contentType } };

  if (filePath.endsWith('.html')) {
    const rewritten = rewriteHtml(readFileSync(filePath, 'utf8'), rel, blobBase, ctx.sas);
    await blob.upload(rewritten, Buffer.byteLength(rewritten), options);
  } else {
    await blob.uploadStream(createReadStream(filePath), undefined, undefined, options);
  }
  console.log(`Uploaded ${blobName}`);
}

const reportUrl = `${blobBase}/index.html?${ctx.sas}`;
console.log(`REPORT_HTML_URL=${reportUrl}`);
if (process.env.TF_BUILD) {
  console.log(`##vso[task.setvariable variable=REPORT_HTML_URL;issecret=false]${reportUrl}`);
  const summaryPath = join(process.cwd(), 'html-report-link.md');
  writeFileSync(
    summaryPath,
    `## Report HTML\n\n[Apri il report E2E](${reportUrl})\n`,
    'utf8',
  );
  console.log(`##vso[task.uploadsummary]${summaryPath}`);
}

// ============================================================================
// HELPER
// ============================================================================

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files.sort();
}

function contentTypeFor(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.md':
      return 'text/markdown; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function rewriteHtml(html, relPath, blobBase, sasToken) {
  const dir = posix.dirname(relPath);
  return html.replace(/(src|href)="([^"]+)"/g, (match, attr, url) => {
    if (/^(https?:|mailto:|data:|#)/i.test(url)) {
      return match;
    }
    const resolved = posix.normalize(dir === '.' ? url : posix.join(dir, url)).replace(/^\.\//, '');
    return `${attr}="${blobBase}/${resolved}?${sasToken}"`;
  });
}
