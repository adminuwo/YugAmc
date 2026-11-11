const env = require('./env');

let azureContainerClient = null;
let gcsBucket = null;

// 1. Initialize Azure Blob Storage if Connection String is provided
const azureConnStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (azureConnStr) {
  try {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnStr);
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'yugamc-documents';
    azureContainerClient = blobServiceClient.getContainerClient(containerName);
    console.log(`[Storage] Azure Blob Storage initialized (Container: ${containerName})`);
  } catch (err) {
    console.warn('[Storage Warning] Azure Blob Storage initialization failed:', err.message);
  }
}

// 2. Fallback to Google Cloud Storage if GCP credentials/project are configured
if (!azureContainerClient && env.GCP_PROJECT_ID && env.GCS_BUCKET_NAME) {
  try {
    const { Storage } = require('@google-cloud/storage');
    const storageClient = new Storage({ projectId: env.GCP_PROJECT_ID });
    gcsBucket = storageClient.bucket(env.GCS_BUCKET_NAME);
    console.log(`[Storage] GCS Bucket initialized: ${env.GCS_BUCKET_NAME}`);
  } catch (err) {
    console.warn('[Storage Warning] GCS initialization failed:', err.message);
  }
}

module.exports = {
  azureContainerClient,
  gcsBucket,
  provider: azureContainerClient ? 'azure' : (gcsBucket ? 'gcs' : 'none')
};
