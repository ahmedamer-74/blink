import { deriveSharedSecret, deriveKey } from "./utils.js";
import type { KeyPair, KeyBundle } from "./types.js";

/**
 * X3DH (Extended Triple Diffie-Hellman) Key Agreement Protocol
 */
export class X3DH {
  /**
   * Initiator's side: Generate shared secret from recipient's key bundle
   */
  static initiate(
    identityKey: KeyPair,
    ephemeralKey: KeyPair,
    recipientBundle: KeyBundle
  ): Uint8Array {
    const dh1 = deriveSharedSecret(
      identityKey.privateKey,
      recipientBundle.signedPreKey.publicKey
    );

    const dh2 = deriveSharedSecret(
      ephemeralKey.privateKey,
      recipientBundle.identityKey
    );

    const dh3 = deriveSharedSecret(
      ephemeralKey.privateKey,
      recipientBundle.signedPreKey.publicKey
    );

    const dh4Parts = recipientBundle.oneTimePreKey
      ? deriveSharedSecret(ephemeralKey.privateKey, recipientBundle.oneTimePreKey.publicKey)
      : new Uint8Array(32);

    const combined = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4Parts.length);
    combined.set(dh1, 0);
    combined.set(dh2, dh1.length);
    combined.set(dh3, dh1.length + dh2.length);
    combined.set(dh4Parts, dh1.length + dh2.length + dh3.length);

    return deriveKey(combined, new TextEncoder().encode("X3DH"));
  }

  /**
   * Responder's side: Generate shared secret from initiator's public keys
   */
  static respond(
    identityKey: KeyPair,
    signedPreKey: KeyPair,
    oneTimePreKey: KeyPair | null,
    initiatorIdentityKey: Uint8Array,
    initiatorEphemeralKey: Uint8Array
  ): Uint8Array {
    const dh1 = deriveSharedSecret(
      signedPreKey.privateKey,
      initiatorIdentityKey
    );

    const dh2 = deriveSharedSecret(
      identityKey.privateKey,
      initiatorEphemeralKey
    );

    const dh3 = deriveSharedSecret(
      signedPreKey.privateKey,
      initiatorEphemeralKey
    );

    const dh4Parts = oneTimePreKey
      ? deriveSharedSecret(oneTimePreKey.privateKey, initiatorEphemeralKey)
      : new Uint8Array(32);

    const combined = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4Parts.length);
    combined.set(dh1, 0);
    combined.set(dh2, dh1.length);
    combined.set(dh3, dh1.length + dh2.length);
    combined.set(dh4Parts, dh1.length + dh2.length + dh3.length);

    return deriveKey(combined, new TextEncoder().encode("X3DH"));
  }
}
