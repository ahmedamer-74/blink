import { x25519 } from "@noble/curves/ed25519";
import { bytesToBase64, computeHMAC } from "./utils.js";
import type { KeyPair, SignedPreKey, OneTimePreKey } from "./types.js";

/**
 * Generate a new X25519 key pair for identity or ephemeral keys
 */
export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Generate a signed pre-key with signature
 * In a real implementation, this would be signed with the identity key
 */
export function generateSignedPreKey(
  identityPrivateKey: Uint8Array
): SignedPreKey {
  const keyPair = generateKeyPair();

  // Sign the public key with identity key (simplified - using HMAC)
  const signature = computeHMAC(identityPrivateKey, keyPair.publicKey);

  return {
    keyPair,
    signature,
  };
}

/**
 * Generate one-time pre-keys for initial key exchange
 */
export function generateOneTimePreKeys(count: number = 100): OneTimePreKey[] {
  const preKeys: OneTimePreKey[] = [];

  for (let i = 0; i < count; i++) {
    const keyPair = generateKeyPair();
    preKeys.push({
      keyPair,
      id: i + 1,
    });
  }

  return preKeys;
}

/**
 * Serialize a key bundle for storage/transmission
 */
export function serializeKeyBundle(
  identityKey: Uint8Array,
  signedPreKey: SignedPreKey,
  oneTimePreKey?: OneTimePreKey
) {
  return {
    identityKey: bytesToBase64(identityKey),
    signedPreKey: {
      publicKey: bytesToBase64(signedPreKey.keyPair.publicKey),
      signature: bytesToBase64(signedPreKey.signature),
    },
    oneTimePreKey: oneTimePreKey
      ? {
          publicKey: bytesToBase64(oneTimePreKey.keyPair.publicKey),
          id: oneTimePreKey.id,
        }
      : undefined,
  };
}
