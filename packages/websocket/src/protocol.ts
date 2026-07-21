import type { WSEnvelope } from "@repo/types";

export function createMessage<T>(event: string, data: T): WSEnvelope<T> {
  return {
    event,
    data,
    timestamp: Date.now(),
  };
}

export function createErrorMessage(
  code: string,
  message: string,
  requestId?: string,
): WSEnvelope<{ code: string; message: string }> {
  return {
    event: "error",
    data: { code, message },
    timestamp: Date.now(),
    requestId,
  };
}

export function parseMessage(raw: string): WSEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as WSEnvelope;
    if (typeof parsed.event !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
