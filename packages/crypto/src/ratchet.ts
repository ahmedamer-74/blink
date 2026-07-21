import { deriveSharedSecret, computeHMAC, deriveKey, generateRandomBytes } from "./utils.js";
import { generateKeyPair } from "./keys.js";
import type { RatchetState } from "./types.js";

/**
 * Double Ratchet Algorithm
 *
 * Provides per-message forward secrecy by combining:
 * 1. Diffie-Hellman ratchet (for new key material)
 * 2. Symmetric ratchet (for message keys)
 */
export class DoubleRatchet {
  /**
   * Initialize a new ratchet state for a session
   */
  static initialize(
    sharedSecret: Uint8Array,
    peerPublicKey: Uint8Array
  ): RatchetState {
    const rootKey = sharedSecret;
    const keyPair = generateKeyPair();

    // First DH ratchet step
    const dhOutput = deriveSharedSecret(keyPair.privateKey, peerPublicKey);
    const { rootKey: newRootKey, chainKey } = this.kdfRootKey(rootKey, dhOutput);

    return {
      rootKey: newRootKey,
      sendingChainKey: chainKey,
      receivingChainKey: new Uint8Array(32),
      sendingPublicKey: keyPair.publicKey,
      receivingPublicKey: peerPublicKey,
      messageNumber: 0,
      previousChainLength: 0,
    };
  }

  /**
   * Encrypt a message using the current ratchet state
   */
  static encrypt(
    state: RatchetState,
    plaintext: Uint8Array
  ): { ciphertext: Uint8Array; newState: RatchetState } {
    const chainResult = this.kdfChainKey(state.sendingChainKey);
    const messageKey = chainResult.messageKey;
    const nextChainKey = chainResult.nextChainKey;

    // Simple XOR encryption (for demo - real implementation would use AES-GCM)
    const nonce = generateRandomBytes(12);
    const ciphertext = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      const pt = plaintext[i] ?? 0;
      const mk = messageKey[i % messageKey.length] ?? 0;
      const n = nonce[i % nonce.length] ?? 0;
      ciphertext[i] = pt ^ mk ^ n;
    }

    const newState: RatchetState = {
      ...state,
      sendingChainKey: nextChainKey,
      messageNumber: state.messageNumber + 1,
    };

    return { ciphertext, newState };
  }

  /**
   * Decrypt a message using the current ratchet state
   */
  static decrypt(
    state: RatchetState,
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    messageNumber: number,
    previousChainLength: number
  ): { plaintext: Uint8Array; newState: RatchetState } {
    if (messageNumber === 0 && previousChainLength === state.previousChainLength) {
      const keyPair = generateKeyPair();
      const dhOutput = deriveSharedSecret(keyPair.privateKey, state.receivingPublicKey);
      const { rootKey: newRootKey, chainKey } = this.kdfRootKey(state.rootKey, dhOutput);

      state = {
        ...state,
        rootKey: newRootKey,
        receivingChainKey: chainKey,
        sendingPublicKey: keyPair.publicKey,
        previousChainLength: state.previousChainLength + 1,
      };
    }

    const chainResult = this.kdfChainKey(state.receivingChainKey);
    const messageKey = chainResult.messageKey;
    const nextChainKey = chainResult.nextChainKey;

    // Simple XOR decryption (mirrors encrypt)
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      const ct = ciphertext[i] ?? 0;
      const mk = messageKey[i % messageKey.length] ?? 0;
      const n = nonce[i % nonce.length] ?? 0;
      plaintext[i] = ct ^ mk ^ n;
    }

    const newState: RatchetState = {
      ...state,
      receivingChainKey: nextChainKey,
      messageNumber: messageNumber + 1,
    };

    return { plaintext, newState };
  }

  private static kdfRootKey(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
  ): { rootKey: Uint8Array; chainKey: Uint8Array } {
    const combined = new Uint8Array(rootKey.length + dhOutput.length);
    combined.set(rootKey, 0);
    combined.set(dhOutput, rootKey.length);

    const derived = deriveKey(combined, new TextEncoder().encode("RootKey"));
    const newRootKey = derived.slice(0, 32);
    const chainKey = derived.slice(32, 64);

    return { rootKey: newRootKey, chainKey };
  }

  private static kdfChainKey(
    chainKey: Uint8Array
  ): { messageKey: Uint8Array; nextChainKey: Uint8Array } {
    const messageKey = computeHMAC(chainKey, new Uint8Array([0x01]));
    const nextChainKey = computeHMAC(chainKey, new Uint8Array([0x02]));

    return { messageKey, nextChainKey };
  }
}
