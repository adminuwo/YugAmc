const { azureContainerClient, gcsBucket, provider } = require('../config/storage');

/**
 * Uploads a local file to cloud storage (Azure Blob Storage or GCS).
 * @param {string} localFilePath - Path to the local file.
 * @param {string} destinationName - Destination filename / blob name.
 * @returns {Promise<any>}
 */
const uploadFile = async (localFilePath, destinationName) => {
  if (azureContainerClient) {
    const blockBlobClient = azureContainerClient.getBlockBlobClient(destinationName);
    return blockBlobClient.uploadFile(localFilePath);
  }
  if (gcsBucket) {
    return gcsBucket.upload(localFilePath, { destination: destinationName });
  }
  console.warn(`[Storage Warning] No cloud storage configured. Skipped upload for ${destinationName}`);
  return { filename: destinationName, status: 'skipped' };
};

/**
 * Deletes a file from cloud storage.
 * @param {string} filename - Name of the file/blob.
 * @returns {Promise<any>}
 */
const deleteFile = async (filename) => {
  if (azureContainerClient) {
    const blockBlobClient = azureContainerClient.getBlockBlobClient(filename);
    return blockBlobClient.deleteIfExists();
  }
  if (gcsBucket) {
    return gcsBucket.file(filename).delete();
  }
  return { filename, status: 'skipped' };
};

module.exports = {
  uploadFile,
  deleteFile,
  provider
};
