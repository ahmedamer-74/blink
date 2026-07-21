import { S3Client } from "@aws-sdk/client-s3";
import type { StorageConfig } from "./types.js";

let client: S3Client | null = null;
let config: StorageConfig | null = null;

export function initStorage(storageConfig: StorageConfig): void {
  config = storageConfig;
  client = new S3Client({
    region: "auto",
    endpoint: storageConfig.endpoint || `https://${storageConfig.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });
}

export function getStorageClient(): S3Client {
  if (!client) {
    throw new Error("Storage not initialized. Call initStorage() first.");
  }
  return client;
}

export function getStorageConfig(): StorageConfig {
  if (!config) {
    throw new Error("Storage not initialized. Call initStorage() first.");
  }
  return config;
}
