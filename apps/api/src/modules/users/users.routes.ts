import { Router } from "express";
import { UsersController } from "./users.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "@repo/validation";
import { updateUserSchema, userIdParamSchema } from "@repo/validation";

const router = Router();
const controller = new UsersController();

// Profile routes
router.get("/me", authenticate, controller.getProfile);
router.patch("/me", authenticate, validate({ body: updateUserSchema }), controller.updateProfile);

// Search route (any authenticated user)
router.get("/search", authenticate, controller.search);

// Admin routes
router.get("/", authenticate, authorize("ADMIN", "SUPERADMIN"), controller.findAll);
router.get("/:id", authenticate, validate({ params: userIdParamSchema }), controller.findById);
router.patch("/:id", authenticate, validate({ params: userIdParamSchema, body: updateUserSchema }), controller.update);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPERADMIN"), validate({ params: userIdParamSchema }), controller.delete);

export { router as usersRoutes };
