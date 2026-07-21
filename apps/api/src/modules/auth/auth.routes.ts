import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "@repo/validation";
import { registerSchema, loginSchema, refreshSchema } from "@repo/validation";
import { authenticate } from "../../middleware/authenticate.js";
import { authRateLimiter } from "../../middleware/rateLimiter.js";

const router = Router();
const controller = new AuthController();

router.post("/register", authRateLimiter, validate({ body: registerSchema }), controller.register);
router.post("/login", authRateLimiter, validate({ body: loginSchema }), controller.login);
router.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
router.post("/logout", authenticate, controller.logout);

export { router as authRoutes };
