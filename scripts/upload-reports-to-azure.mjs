import 'dotenv/config';

import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { getStorageContext } from './azure-storage-context.mjs';
import { PATHS } from '../config.js';

// Sincronizza lo storico dei report con Azure Blob:
// 1. scarica lo storico esistente (<prefix>/) in reports/
// 2. carica i report della run corrente (merge: i file locali hanno la priorità)
// La dashboard Next.js (/reports) legge i JSON direttamente dal container.

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip history sync.');
  process.exit(0);
}

const blobPrefix = ctx.prefix;

const blobs = [];
for await (const blob of ctx.container.listBlobsFlat({ prefix: `${blobPrefix}/` })) {
  if (blob.name.endsWith('/')) continue;
  blobs.push(blob.name);
}

if (blobs.length) {
  console.log(`Trovati ${blobs.length} blob nello storico — download in ${PATHS.reports}/...`);
  for (const blobName of blobs) {
    const rel = blobName.slice(blobPrefix.length + 1);
    const target = join(PATHS.reports, rel);
    if (existsSync(target)) continue; // i file della run corrente hanno la priorità
    mkdirSync(dirname(target), { recursive: true });
    await ctx.container.getBlockBlobClient(blobName).downloadToFile(target);
  }
  console.log('Storico scaricato e merge completato.');
} else {
  console.log('Nessuno storico presente su blob — parte da zero.');
}

// --- Upload dei report raw della run corrente (merge nello stesso path) ---
const localFiles = existsSync(PATHS.reports) ? listFiles(PATHS.reports) : [];
if (!localFiles.length) {
  console.log(`No files in ${PATHS.reports}/ — skip raw upload.`);
  process.exit(0);
}

for (const filePath of localFiles) {
  const rel = relative(PATHS.reports, filePath).replaceAll('\\', '/');
  const blobName = `${blobPrefix}/${rel}`;
  const blob = ctx.container.getBlockBlobClient(blobName);
  const options = { blobHTTPHeaders: { blobContentType: contentTypeFor(filePath) } };
  await blob.uploadStream(createReadStream(filePath), undefined, undefined, options);
  console.log(`Uploaded ${blobName}`);
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
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
