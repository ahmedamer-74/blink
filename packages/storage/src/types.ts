export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  endpoint?: string;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export interface PresignDownloadResult {
  downloadUrl: string;
  key: string;
}
