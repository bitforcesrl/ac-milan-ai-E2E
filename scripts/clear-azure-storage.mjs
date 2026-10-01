import 'dotenv/config';
import { getStorageContext } from './azure-storage-context.mjs';

// Cancella TUTTI i blob di reportistica sul container Azure.
// Utile per ripartire da uno storico pulito (es. dopo un cambio di layout dei path).

const ctx = await getStorageContext();
if (!ctx) {
  console.log('AZURE_STORAGE_CONNECTION_STRING not set — skip cleanup.');
  process.exit(0);
}

const blobs = [];
for await (const blob of ctx.container.listBlobsFlat()) {
  blobs.push(blob.name);
}

if (!blobs.length) {
  console.log('Container vuoto — nulla da cancellare.');
  process.exit(0);
}

console.log(`Cancellazione di ${blobs.length} blob dal container ${ctx.containerName}...`);
for (const name of blobs) {
  await ctx.container.deleteBlob(name);
  console.log(`Deleted ${name}`);
}
console.log('Cleanup completato.');
