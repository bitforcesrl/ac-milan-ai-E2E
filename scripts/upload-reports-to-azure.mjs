import 'dotenv/config';

import { createReadStream, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { createJiti } from 'jiti';
import { getStorageContext } from './azure-storage-context.mjs';

const jiti = createJiti(import.meta.url);
const { PATHS } = await jiti.import('../config.ts');
import {
  RUN_INDEX_FILE,
  mergeRunIndex,
  parseRunIndex,
  readRunIndexFile,
  runIndexPath,
} from './run-index.mjs';

// Sincronizza i report della run corrente con Azure Blob:
// 1. scarica il solo index.json remoto e lo fonde con quello locale
// 2. carica i report della run corrente
// La dashboard Next.js (/reports) legge i JSON direttamente dal container,
// quindi NON serve scaricare l'intero storico su disco.
// Per scaricare lo storico completo in locale usare scripts/download-reports-from-azure.mjs.

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip upload.');
  process.exit(0);
}

// --- Merge di reports/index.json con lo storico remoto -----------------------
// run-e2e-ci.mjs scrive in locale un index.json con SOLO la run corrente.
// Prima dell'upload lo fondiamo con l'index.json remoto (storico delle run
// precedenti) cosi' il blob pubblicato contiene tutte le run, senza duplicati.
// Operazione idempotente: rilanciare lo script non crea record duplicati.
const localIndexPath = runIndexPath(PATHS.reports);
if (existsSync(localIndexPath)) {
  let remoteEntries = [];
  try {
    const buf = await ctx.container.getBlockBlobClient(RUN_INDEX_FILE).downloadToBuffer();
    remoteEntries = parseRunIndex(buf.toString('utf8'));
  } catch {
    remoteEntries = []; // blob assente o illeggibile: si parte dal solo locale
  }
  const localEntries = parseRunIndex(readRunIndexFile(PATHS.reports));
  const merged = mergeRunIndex(remoteEntries, localEntries);
  writeFileSync(localIndexPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Index run merged: ${localIndexPath} (${merged.length} run, remote ${remoteEntries.length})`);
}

// --- Upload dei report raw della run corrente (merge nello stesso path) ---
const localFiles = existsSync(PATHS.reports) ? listFiles(PATHS.reports) : [];
if (!localFiles.length) {
  console.log(`No files in ${PATHS.reports}/ — skip raw upload.`);
  process.exit(0);
}

for (const filePath of localFiles) {
  const blobName = relative(PATHS.reports, filePath).replaceAll('\\', '/');
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
