import { BlobServiceClient } from '@azure/storage-blob';
import { BLOB_PREFIX } from '../config.js';

// Contesto condiviso per accedere ad Azure Blob Storage.
// Usato da sync-history.mjs (upload/download storico) e clean-azure-blobs.mjs (cleanup).
export async function getStorageContext() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (!connectionString || connectionString.startsWith('$(')) {
    return null; // credenziali non disponibili: gli script chiamanti skippano
  }

  const containerName = !process.env.AZURE_STORAGE_CONTAINER?.trim() || process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
    ? 'e2e-reports'
    : process.env.AZURE_STORAGE_CONTAINER.trim();

  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(containerName);

  try {
    await container.createIfNotExists();
  } catch (err) {
    console.log(`Container ${containerName} not created (${err.code || err.message}); assuming it exists.`);
  }

  return {
    container,
    containerName,
    // Prefisso fisso su blob: lo storico si accumula sempre nello stesso path
    prefix: (process.env.REPORT_BLOB_PREFIX || BLOB_PREFIX).replace(/^\/+|\/+$/g, ''),
  };
}

