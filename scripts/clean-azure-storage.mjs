import 'dotenv/config';
import { getStorageContext } from './azure-storage-context.mjs';

// Cancella TUTTI i blob di reportistica sotto <prefix>/ sul container Azure.
// Utile per ripartire da uno storico pulito (es. dopo un cambio di layout dei path).

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip cleanup.');
  process.exit(0);
}

const blobs = [];
for await (const blob of ctx.container.listBlobsFlat({ prefix: `${ctx.prefix}/` })) {
  blobs.push(blob.name);
}

if (!blobs.length) {
  console.log(`Nessun blob sotto ${ctx.prefix}/ — nulla da cancellare.`);
  process.exit(0);
}

console.log(`Cancellazione di ${blobs.length} blob sotto ${ctx.prefix}/...`);
for (const name of blobs) {
  await ctx.container.deleteBlob(name);
  console.log(`Deleted ${name}`);
}
console.log('Cleanup completato.');
