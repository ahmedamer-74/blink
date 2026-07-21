import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient, getStorageConfig } from "./client.js";
import type { PresignResult, PresignDownloadResult } from "./types.js";

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<PresignResult> {
  const client = getStorageClient();
  const config = getStorageConfig();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = `${config.publicUrl}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
  };
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<PresignDownloadResult> {
  const client = getStorageClient();
  const config = getStorageConfig();

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    downloadUrl,
    key,
  };
}

export function generateMediaKey(
  userId: string,
  filename: string,
  prefix: string = "media"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "bin";
  return `${prefix}/${userId}/${timestamp}-${random}.${ext}`;
}
