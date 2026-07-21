export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPreKey {
  keyPair: KeyPair;
  signature: Uint8Array;
}

export interface OneTimePreKey {
  keyPair: KeyPair;
  id: number;
}

export interface KeyBundle {
  identityKey: Uint8Array;
  signedPreKey: {
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  oneTimePreKey?: {
    publicKey: Uint8Array;
    id: number;
  };
}

export interface EncryptedMessage {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  messageKey: Uint8Array;
  chainKey: Uint8Array;
  messageNumber: number;
  previousChainLength: number;
}

export interface RatchetState {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingPublicKey: Uint8Array;
  receivingPublicKey: Uint8Array;
  messageNumber: number;
  previousChainLength: number;
}

export interface SessionState {
  id: string;
  userId: string;
  peerId: string;
  ratchetState: RatchetState;
  createdAt: Date;
  updatedAt: Date;
}
