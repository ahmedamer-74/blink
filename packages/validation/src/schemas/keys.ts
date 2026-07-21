import { z } from "zod";

export const uploadKeyBundleSchema = z.object({
  identityKey: z.string().min(1), // base64-encoded
  signedPreKey: z.string().min(1), // base64-encoded
  signedPreKeySig: z.string().min(1), // base64-encoded signature
  oneTimePreKeys: z.array(z.string().min(1)).min(1).max(100), // array of base64-encoded keys
});

export const claimPreKeySchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const keyUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});
