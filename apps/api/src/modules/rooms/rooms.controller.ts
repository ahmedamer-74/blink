import type { Request, Response, NextFunction } from "express";
import { RoomsService } from "./rooms.service.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const service = new RoomsService();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0]! : (v ?? "");
}

export class RoomsController {
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const room = await service.create(authReq.user!.id, req.body);
      res.status(201).json({ success: true, message: "Room created", data: room, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const room = await service.findById(param(req, "id"));
      res.json({ success: true, message: "Room retrieved", data: room, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  findUserRooms = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const rooms = await service.findUserRooms(authReq.user!.id);
      res.json({ success: true, message: "Rooms retrieved", data: rooms, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  findPendingRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const rooms = await service.findPendingRequests(authReq.user!.id);
      res.json({ success: true, message: "Pending requests", data: rooms, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await service.accept(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Request accepted", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await service.reject(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Request rejected", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  join = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const membership = await service.join(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Joined room", data: membership, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  leave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      await service.leave(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Left room", data: null, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      await service.delete(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Room deleted", data: null, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const room = await service.createGroup(authReq.user!.id, req.body);
      res.status(201).json({ success: true, message: "Group created", data: room, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  updateGroupInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const room = await service.updateGroupInfo(param(req, "id"), authReq.user!.id, req.body);
      res.json({ success: true, message: "Group updated", data: room, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  addMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const users = await service.addMembers(param(req, "id"), authReq.user!.id, req.body.userIds);
      res.json({ success: true, message: "Members added", data: users, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await service.removeMember(param(req, "id"), authReq.user!.id, param(req, "userId"));
      res.json({ success: true, message: "Member removed", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  promoteAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await service.promoteAdmin(param(req, "id"), authReq.user!.id, param(req, "userId"));
      res.json({ success: true, message: "Member promoted", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  demoteAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await service.demoteAdmin(param(req, "id"), authReq.user!.id, param(req, "userId"));
      res.json({ success: true, message: "Admin demoted", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  getGroupMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await service.getGroupMembers(param(req, "id"));
      res.json({ success: true, message: "Members retrieved", data: members, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  updateMuteStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { mutedUntil } = req.body;
      const membership = await service.updateMuteStatus(
        param(req, "id"),
        authReq.user!.id,
        mutedUntil ? new Date(mutedUntil) : null
      );
      res.json({ success: true, message: "Mute status updated", data: membership, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };
}
