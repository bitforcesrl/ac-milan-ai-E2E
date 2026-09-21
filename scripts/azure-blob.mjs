import {
  BlobServiceClient,
  ContainerSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { BLOB_PREFIX } from '../config.js';

const sasDays = Number(process.env.REPORT_SAS_DAYS || 90);

// Contesto condiviso per accedere ad Azure Blob Storage.
// Usato da upload-reports.mjs (upload HTML) e sync-history.mjs (download storico raw).
export async function getStorageContext() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (!connectionString || connectionString.startsWith('$(')) {
    return null; // credenziali non disponibili: gli script chiamanti skippano
  }

  const containerName = !process.env.AZURE_STORAGE_CONTAINER?.trim() || process.env.AZURE_STORAGE_CONTAINER.startsWith('$(')
    ? 'e2e-reports'
    : process.env.AZURE_STORAGE_CONTAINER.trim();

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

  return {
    container,
    containerName,
    sas,
    // Prefisso fisso su blob: lo storico si accumula sempre nello stesso path
    prefix: (process.env.REPORT_BLOB_PREFIX || BLOB_PREFIX).replace(/^\/+|\/+$/g, ''),
  };
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
