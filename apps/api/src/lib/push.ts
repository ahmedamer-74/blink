import webpush from "web-push";
import { logger } from "@repo/logger";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL;

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_EMAIL);
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

export function initPush() {
  if (!isPushConfigured()) {
    logger.warn("Web push not configured — VAPID keys missing");
    return;
  }

  webpush.setVapidDetails(
    VAPID_EMAIL!,
    VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY!,
  );

  logger.info("Web push initialized");
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
): Promise<boolean> {
  if (!isPushConfigured()) return false;

  try {
    await webpush.sendNotification(
      subscription,
      payload,
      { TTL: 60 * 60 }, // 1 hour
    );
    return true;
  } catch (err: any) {
    // 404 = subscription expired, 410 = subscription unsubscribed
    if (err.statusCode === 404 || err.statusCode === 410) {
      logger.info({ endpoint: subscription.endpoint }, "Push subscription expired");
      return false; // caller should remove this subscription
    }
    logger.error({ err: err.message }, "Push notification failed");
    return false;
  }
}
