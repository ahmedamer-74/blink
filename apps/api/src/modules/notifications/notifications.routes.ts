import { Router } from "express";
import { NotificationsController } from "./notifications.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();
const controller = new NotificationsController();

router.get("/vapid-public-key", controller.getPublicKey);
router.post("/subscribe", authenticate, controller.subscribe);
router.post("/unsubscribe", authenticate, controller.unsubscribe);

export { router as notificationsRoutes };
