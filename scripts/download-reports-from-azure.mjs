import 'dotenv/config';

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getStorageContext } from './azure-storage-context.mjs';
import { PATHS } from '../config.js';

// Scarica l'intero storico dei report da Azure Blob in reports/.
// Utile per ispezioni locali o consumer offline; NON e' necessario per la
// dashboard Next.js (/reports), che legge i blob direttamente dal container.
//
// Uso:
//   node scripts/download-reports-from-azure.mjs                 # tutto lo storico
//   node scripts/download-reports-from-azure.mjs 2026-09-30_20-01-29   # solo una run
//
// Opzionale: --force sovrascrive i file locali gia' presenti.

const args = process.argv.slice(2);
const force = args.includes('--force');
const runPrefix = args.find((a) => !a.startsWith('--'));

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip download.');
  process.exit(0);
}

const blobs = [];
for await (const blob of ctx.container.listBlobsFlat()) {
  if (blob.name.endsWith('/')) continue;
  if (runPrefix && !blob.name.startsWith(runPrefix)) continue;
  blobs.push(blob.name);
}

if (!blobs.length) {
  console.log(runPrefix ? `Nessun blob trovato per la run "${runPrefix}".` : 'Nessuno storico presente su blob.');
  process.exit(0);
}

console.log(`Trovati ${blobs.length} blob — download in ${PATHS.reports}/...`);
let downloaded = 0;
let skipped = 0;
for (const blobName of blobs) {
  const target = join(PATHS.reports, blobName);
  if (!force && existsSync(target)) {
    skipped++;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  await ctx.container.getBlockBlobClient(blobName).downloadToFile(target);
  downloaded++;
  console.log(`Downloaded ${blobName}`);
}

console.log(`Completato: ${downloaded} scaricati, ${skipped} gia' presenti (skip).`);