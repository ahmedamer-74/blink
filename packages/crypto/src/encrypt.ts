import { DoubleRatchet } from "./ratchet.js";
import { generateRandomBytes, bytesToBase64, base64ToBytes } from "./utils.js";
import type { RatchetState, EncryptedMessage } from "./types.js";

/**
 * Encrypt a message for sending
 */
export function encryptMessage(
  state: RatchetState,
  plaintext: string
): { encrypted: EncryptedMessage; newState: RatchetState } {
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const { ciphertext, newState } = DoubleRatchet.encrypt(state, plaintextBytes);

  return {
    encrypted: {
      ciphertext,
      nonce: generateRandomBytes(12),
      messageKey: new Uint8Array(32),
      chainKey: newState.sendingChainKey,
      messageNumber: newState.messageNumber - 1,
      previousChainLength: newState.previousChainLength,
    },
    newState,
  };
}

/**
 * Decrypt a received message
 */
export function decryptMessage(
  state: RatchetState,
  encrypted: EncryptedMessage
): { plaintext: string; newState: RatchetState } {
  const { plaintext: plaintextBytes, newState } = DoubleRatchet.decrypt(
    state,
    encrypted.ciphertext,
    encrypted.nonce,
    encrypted.messageNumber,
    encrypted.previousChainLength
  );

  const plaintext = new TextDecoder().decode(plaintextBytes);
  return { plaintext, newState };
}

/**
 * Serialize encrypted message for transmission
 */
export function serializeEncryptedMessage(encrypted: EncryptedMessage): string {
  return JSON.stringify({
    ciphertext: bytesToBase64(encrypted.ciphertext),
    nonce: bytesToBase64(encrypted.nonce),
    messageKey: bytesToBase64(encrypted.messageKey),
    chainKey: bytesToBase64(encrypted.chainKey),
    messageNumber: encrypted.messageNumber,
    previousChainLength: encrypted.previousChainLength,
  });
}

/**
 * Deserialize encrypted message from transmission
 */
export function deserializeEncryptedMessage(data: string): EncryptedMessage {
  const parsed = JSON.parse(data);
  return {
    ciphertext: base64ToBytes(parsed.ciphertext),
    nonce: base64ToBytes(parsed.nonce),
    messageKey: base64ToBytes(parsed.messageKey),
    chainKey: base64ToBytes(parsed.chainKey),
    messageNumber: parsed.messageNumber,
    previousChainLength: parsed.previousChainLength,
  };
}
