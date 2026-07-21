// E2EE Crypto Package - Signal Protocol Foundation

export { generateKeyPair, generateSignedPreKey, generateOneTimePreKeys } from "./keys.js";
export { X3DH } from "./x3dh.js";
export { DoubleRatchet } from "./ratchet.js";
export { encryptMessage, decryptMessage } from "./encrypt.js";
export { deriveSharedSecret, computeHMAC, verifyHMAC } from "./utils.js";

export type {
  KeyPair,
  SignedPreKey,
  OneTimePreKey,
  KeyBundle,
  EncryptedMessage,
  RatchetState,
  SessionState,
} from "./types.js";
