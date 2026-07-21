# Chapter 07: End-to-End Encryption (E2EE)

---

## What Problem Does This Solve?

Without E2EE, the server can read every message. If the server is compromised, or a malicious admin wants to snoop, all chat history is exposed. E2EE ensures that only the sender and recipient can read the message contents — the server sees only ciphertext.

Blink's E2EE implementation is based on the **Signal Protocol**, the same encryption system used by Signal, WhatsApp, and Google Messages. It's implemented in `packages/crypto/` but is **not yet integrated into the message flow** — the server currently stores messages in plaintext.

## How It Works in General

### The Signal Protocol

The Signal Protocol combines two key ideas:

1. **X3DH (Extended Triple Diffie-Hellman)**: A key agreement protocol that lets two users establish a shared secret even if they've never communicated before. It uses three types of keys:
   - **Identity key**: Long-lived key pair (like a public key for your account).
   - **Signed pre-key**: Rotated periodically, signed by the identity key.
   - **One-time pre-keys**: Single-use keys for initial contact.

2. **Double Ratchet**: A message encryption algorithm that derives a new encryption key for every message. Even if one key is compromised, past and future messages remain secure (forward secrecy + future secrecy).

### Forward Secrecy

If an attacker records all encrypted traffic and later steals your private key, they can't decrypt old messages. Each message uses a unique key derived from a chain of key derivations. Compromising one key only reveals that one message, not the entire history.

## How We Do It Here

### Key Generation (`packages/crypto/src/keys.ts`)

```typescript
import { x25519 } from "@noble/curves/ed25519";

export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export function generateSignedPreKey(identityPrivateKey: Uint8Array): SignedPreKey {
  const keyPair = generateKeyPair();
  const signature = computeHMAC(identityPrivateKey, keyPair.publicKey);
  return { keyPair, signature };
}

export function generateOneTimePreKeys(count: number = 100): OneTimePreKey[] {
  const preKeys: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    preKeys.push({ keyPair: generateKeyPair(), id: i + 1 });
  }
  return preKeys;
}
```

- **X25519**: An elliptic curve Diffie-Hellman algorithm. Fast, secure, and used by Signal. The `@noble/curves` library provides a pure JavaScript implementation.
- **Identity key**: Generated once per user. The private key never leaves the device.
- **Signed pre-key**: Generated periodically. The signature proves it came from the identity key holder.
- **One-time pre-keys**: Generated in batches of 100. Each is used once for a new conversation, then discarded.

### X3DH Key Agreement (`packages/crypto/src/x3dh.ts`)

```typescript
export class X3DH {
  static initiate(
    identityKey: KeyPair,
    ephemeralKey: KeyPair,
    recipientBundle: KeyBundle
  ): Uint8Array {
    const dh1 = deriveSharedSecret(identityKey.privateKey, recipientBundle.signedPreKey.publicKey);
    const dh2 = deriveSharedSecret(ephemeralKey.privateKey, recipientBundle.identityKey);
    const dh3 = deriveSharedSecret(ephemeralKey.privateKey, recipientBundle.signedPreKey.publicKey);
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
}
```

The initiator performs four Diffie-Hellman operations:

1. `dh1`: Their identity key × recipient's signed pre-key
2. `dh2`: Their ephemeral key × recipient's identity key
3. `dh3`: Their ephemeral key × recipient's signed pre-key
4. `dh4`: Their ephemeral key × recipient's one-time pre-key (if available)

The four shared secrets are concatenated and derived into a single shared secret using HKDF. This provides:
- **Authentication**: Only the identity key holder can decrypt (dh1, dh2).
- **Forward secrecy**: The ephemeral key is thrown away after use.
- **One-time secrecy**: The one-time pre-key is consumed.

### Double Ratchet (`packages/crypto/src/ratchet.ts`)

```typescript
export class DoubleRatchet {
  static initialize(sharedSecret: Uint8Array, peerPublicKey: Uint8Array): RatchetState {
    const rootKey = sharedSecret;
    const keyPair = generateKeyPair();
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

  static encrypt(state: RatchetState, plaintext: Uint8Array) {
    const chainResult = this.kdfChainKey(state.sendingChainKey);
    const messageKey = chainResult.messageKey;
    const nextChainKey = chainResult.nextChainKey;

    const nonce = generateRandomBytes(12);
    const ciphertext = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      ciphertext[i] = plaintext[i]! ^ messageKey[i % messageKey.length]! ^ nonce[i % nonce.length]!;
    }

    return {
      ciphertext,
      newState: { ...state, sendingChainKey: nextChainKey, messageNumber: state.messageNumber + 1 },
    };
  }
}
```

The ratchet has two chains:

- **Sending chain**: Derives message keys from `sendingChainKey`. After each message, the chain key advances.
- **Receiving chain**: Derives message keys from `receivingChainKey`. Advanced when a new message arrives.

The `kdfChainKey` function derives both a message key and the next chain key:

```typescript
private static kdfChainKey(chainKey: Uint8Array) {
  const messageKey = computeHMAC(chainKey, new Uint8Array([0x01]));
  const nextChainKey = computeHMAC(chainKey, new Uint8Array([0x02]));
  return { messageKey, nextChainKey };
}
```

**Note**: The current implementation uses XOR encryption for simplicity. A production implementation would use AES-256-GCM (authenticated encryption). The ratchet structure is correct; the encryption primitive needs upgrading.

### Key Bundle Storage

Users upload their public keys to the server via the `UserKeyBundle` model:

```prisma
model UserKeyBundle {
  id              String   @id @default(uuid()) @db.Uuid
  identityKey     String   // base64-encoded public identity key
  signedPreKey    String   // base64-encoded public signed pre-key
  signedPreKeySig String   // signature over signed pre-key
  oneTimePreKeys  Json     // array of base64-encoded one-time pre-keys
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("user_key_bundles")
}
```

The server stores only **public keys**. Private keys never leave the client. When Alice wants to message Bob:

1. Alice fetches Bob's `UserKeyBundle` from the server.
2. Alice uses X3DH to derive a shared secret.
3. Alice encrypts the message with Double Ratchet.
4. Alice sends the ciphertext to the server.
5. The server stores the ciphertext and broadcasts it to Bob's room.
6. Bob decrypts with his private key and the shared secret.

### Integration Status

**Implemented**:
- Key generation (identity, signed pre-key, one-time pre-keys)
- X3DH key agreement (initiate and respond)
- Double Ratchet initialization, encryption, decryption
- Key bundle storage in the database
- Serialization/deserialization helpers

**Not yet integrated**:
- Key exchange endpoints (upload/download key bundles)
- Encrypting messages before sending via WebSocket
- Decrypting received messages on the client
- Key rotation (regenerating signed pre-keys)

The crypto package is a standalone library ready for integration. The message flow currently stores plaintext — E2EE will wrap the content in ciphertext before it hits the server.

## Common Mistakes / Gotchas

1. **Storing private keys on the server**: Never. Private keys stay on the device. The server only stores public keys in `UserKeyBundle`.

2. **Reusing ephemeral keys**: Each X3DH session must generate a fresh ephemeral key. Reusing it breaks forward secrecy.

3. **Not deleting consumed one-time pre-keys**: After using a one-time pre-key in X3DH, it should be removed from the bundle. The server should track which pre-keys have been used.

4. **XOR is not secure encryption**: The current `DoubleRatchet.encrypt` uses XOR. This is a demo placeholder — replace with AES-256-GCM before production use.

5. **Forgetting to sync ratchet state**: If the client crashes mid-conversation, the ratchet state must be persisted locally. Losing the state means you can't decrypt future messages.

## Try It Yourself

1. Import `generateKeyPair`, `X3DH`, and `DoubleRatchet` from `@repo/crypto`.
2. Generate two identity key pairs (Alice and Bob).
3. Generate a signed pre-key and one-time pre-key for Bob.
4. Create a key bundle for Bob.
5. Alice initiates X3DH with Bob's bundle → get shared secret.
6. Initialize a Double Ratchet session with the shared secret.
7. Encrypt "Hello Bob" from Alice's side.
8. Decrypt on Bob's side (you'll need to implement Bob's ratchet respond logic).
9. Verify the plaintext matches.
