import type { Response } from "express";
import type { AuthRequest } from "../../middleware/authenticate.js";
import { prisma } from "@repo/database";
import { getVapidPublicKey } from "../../lib/push.js";

export class NotificationsController {
  async getPublicKey(_req: AuthRequest, res: Response) {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      return res.status(503).json({ message: "Push notifications not configured" });
    }
    res.json({ publicKey });
  }

  async subscribe(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid subscription" });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    res.json({ ok: true });
  }

  async unsubscribe(req: AuthRequest, res: Response) {
    const { endpoint } = req.body as { endpoint: string };

    if (!endpoint) {
      return res.status(400).json({ message: "Endpoint required" });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    res.json({ ok: true });
  }
}
