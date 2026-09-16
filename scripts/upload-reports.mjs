import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, posix, relative } from 'node:path';
import {
  BlobServiceClient,
  ContainerSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
const containerName = !process.env.AZURE_STORAGE_CONTAINER?.trim() || process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
  ? 'e2e-reports'
  : process.env.AZURE_STORAGE_CONTAINER.trim();
const reportsDir = 'reports';
const prefix = (process.env.REPORT_BLOB_PREFIX || `e2e/${Date.now()}`).replace(/^\/+|\/+$/g, '');
const sasDays = Number(process.env.REPORT_SAS_DAYS || 90);

if (!connectionString || connectionString.startsWith('$(')) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip blob upload.');
  process.exit(0);
}

if (!existsSync(reportsDir)) {
  console.log('No reports/ folder — skip blob upload.');
  process.exit(0);
}

const files = listFiles(reportsDir);
if (!files.length) {
  console.log('No files in reports/ — skip blob upload.');
  process.exit(0);
}

const { accountName, accountKey } = parseConnectionString(connectionString);
const credential = new StorageSharedKeyCredential(accountName, accountKey);
const service = BlobServiceClient.fromConnectionString(connectionString);
const container = service.getContainerClient(containerName);

try {
  await container.createIfNotExists();
} catch (err) {
  console.log(`Container ${containerName} not created (${err.code || err.message}); assuming it exists.`);
}

const sas = generateBlobSASQueryParameters(
  {
    containerName,
    permissions: ContainerSASPermissions.parse('rl'),
    startsOn: new Date(Date.now() - 5 * 60 * 1000),
    expiresOn: new Date(Date.now() + sasDays * 24 * 60 * 60 * 1000),
    protocol: SASProtocol.Https,
  },
  credential,
).toString();

const blobBase = `${container.url.replace(/\/$/, '')}/${prefix}`;

for (const filePath of files) {
  const rel = relative(reportsDir, filePath).replaceAll('\\', '/');
  const blobName = `${prefix}/${rel}`;
  const blob = container.getBlockBlobClient(blobName);
  const contentType = contentTypeFor(filePath);
  const options = { blobHTTPHeaders: { blobContentType: contentType } };

  if (filePath.endsWith('.html')) {
    const rewritten = rewriteHtml(readFileSync(filePath, 'utf8'), rel, blobBase, sas);
    await blob.upload(rewritten, Buffer.byteLength(rewritten), options);
  } else {
    await blob.uploadStream(createReadStream(filePath), undefined, undefined, options);
  }
  console.log(`Uploaded ${blobName}`);
}

const reportUrl = `${blobBase}/index.html?${sas}`;
console.log(`REPORT_HTML_URL=${reportUrl}`);
if (process.env.TF_BUILD) {
  console.log(`##vso[task.setvariable variable=REPORT_HTML_URL;issecret=false]${reportUrl}`);
}

function parseConnectionString(value) {
  const parts = Object.fromEntries(
    value
      .split(';')
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf('=');
        return [entry.slice(0, index), entry.slice(index + 1)];
      }),
  );
  if (!parts.AccountName || !parts.AccountKey) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING must include AccountName and AccountKey.');
  }
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

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
