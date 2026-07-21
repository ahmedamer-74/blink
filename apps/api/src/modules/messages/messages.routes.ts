import { Router } from "express";
import { MessagesController } from "./messages.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();
const controller = new MessagesController();

router.get("/rooms/:roomId", authenticate, controller.findByRoom);
router.get("/rooms/:roomId/search", authenticate, controller.search);
router.get("/starred", authenticate, controller.getStarred);
router.post("/rooms/:roomId", authenticate, controller.send);
router.patch("/:id", authenticate, controller.update);
router.delete("/:id", authenticate, controller.delete);

export { router as messagesRoutes };
