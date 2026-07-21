import { Router } from "express";
import { RoomsController } from "./rooms.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "@repo/validation";
import {
  createRoomSchema,
  roomIdParamSchema,
  updateRoomSchema,
  addMembersSchema,
} from "@repo/validation";

const router = Router();
const controller = new RoomsController();

// ==================== BASIC ROOM OPERATIONS ====================

router.get("/", authenticate, controller.findUserRooms);
router.get("/pending", authenticate, controller.findPendingRequests);
router.post("/", authenticate, validate({ body: createRoomSchema }), controller.create);
router.get("/:id", authenticate, validate({ params: roomIdParamSchema }), controller.findById);
router.post("/:id/join", authenticate, validate({ params: roomIdParamSchema }), controller.join);
router.post("/:id/accept", authenticate, validate({ params: roomIdParamSchema }), controller.accept);
router.post("/:id/reject", authenticate, validate({ params: roomIdParamSchema }), controller.reject);
router.post("/:id/leave", authenticate, validate({ params: roomIdParamSchema }), controller.leave);
router.delete("/:id", authenticate, validate({ params: roomIdParamSchema }), controller.delete);

// ==================== GROUP OPERATIONS ====================

router.post("/group", authenticate, controller.createGroup);
router.patch("/:id/info", authenticate, validate({ params: roomIdParamSchema }), controller.updateGroupInfo);
router.post("/:id/members", authenticate, validate({ params: roomIdParamSchema }), controller.addMembers);
router.delete("/:id/members/:userId", authenticate, controller.removeMember);
router.post("/:id/members/:userId/promote", authenticate, controller.promoteAdmin);
router.post("/:id/members/:userId/demote", authenticate, controller.demoteAdmin);
router.get("/:id/members", authenticate, validate({ params: roomIdParamSchema }), controller.getGroupMembers);
router.post("/:id/mute", authenticate, validate({ params: roomIdParamSchema }), controller.updateMuteStatus);

export { router as roomsRoutes };
