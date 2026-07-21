import { x25519 } from "@noble/curves/ed25519";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Generate random bytes of specified length
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derive a shared secret using X25519 Diffie-Hellman
 */
export function deriveSharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

/**
 * Compute HMAC-SHA256
 */
export function computeHMAC(
  key: Uint8Array,
  message: Uint8Array
): Uint8Array {
  return hmac(sha256, key, message);
}

/**
 * Verify HMAC-SHA256
 */
export function verifyHMAC(
  key: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  const computed = computeHMAC(key, message);
  return computed.every((byte, i) => byte === signature[i]);
}

/**
 * Derive a key using HKDF
 */
export function deriveKey(
  inputKeyMaterial: Uint8Array,
  info: Uint8Array,
  length: number = 32
): Uint8Array {
  const prk = hmac(sha256, new Uint8Array(32), inputKeyMaterial);
  let key = new Uint8Array(0);
  let counter = 1;

  while (key.length < length) {
    const keyStream = hmac(sha256, prk, new Uint8Array([...info, counter]));
    key = new Uint8Array([...key, ...keyStream]);
    counter++;
  }

  return key.slice(0, length);
}

/**
 * Encode bytes to base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decode base64 to bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
