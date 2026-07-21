import type { Request, Response, NextFunction } from "express";
import { MessagesService } from "./messages.service.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const service = new MessagesService();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0]! : (v ?? "");
}

export class MessagesController {
  findByRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await service.findByRoom(param(req, "roomId"), authReq.user!.id, page, limit);
      res.json({ success: true, message: "Messages retrieved", data: result.messages, errors: null, meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const message = await service.send(authReq.user!.id, param(req, "roomId"), req.body.content);
      res.status(201).json({ success: true, message: "Message sent", data: message, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const message = await service.update(param(req, "id"), authReq.user!.id, req.body.content);
      res.json({ success: true, message: "Message updated", data: message, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      await service.delete(param(req, "id"), authReq.user!.id);
      res.json({ success: true, message: "Message deleted", data: null, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const query = req.query.q as string;
      const limit = Number(req.query.limit) || 20;
      const results = await service.search(param(req, "roomId"), authReq.user!.id, query, limit);
      res.json({ success: true, message: "Search results", data: results, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  getStarred = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const limit = Number(req.query.limit) || 50;
      const starred = await service.getStarred(authReq.user!.id, limit);
      res.json({ success: true, message: "Starred messages", data: starred, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };
}
