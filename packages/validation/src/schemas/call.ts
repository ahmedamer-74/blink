import { z } from "zod";

export const callTypeEnum = z.enum(["voice", "video"]);

export const initiateCallSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  type: callTypeEnum,
});

export const answerCallSchema = z.object({
  callId: z.string().uuid("Invalid call ID"),
  sdp: z.string().min(1), // SDP answer
});

export const rejectCallSchema = z.object({
  callId: z.string().uuid("Invalid call ID"),
});

export const endCallSchema = z.object({
  callId: z.string().uuid("Invalid call ID"),
});

export const iceCandidateSchema = z.object({
  callId: z.string().uuid("Invalid call ID"),
  candidate: z.string().min(1),
  sdpMid: z.string().optional(),
  sdpMLineIndex: z.number().int().optional(),
});

export const callIdParamSchema = z.object({
  callId: z.string().uuid("Invalid call ID"),
});
