import type { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const service = new UsersService();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0]! : (v ?? "");
}

export class UsersController {
  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await service.findById(param(req, "id"));
      res.json({ success: true, message: "User retrieved", data: user, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string) || "";
      const result = await service.search(query);
      res.json({ success: true, message: "Users found", data: result, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.findAll(req.query as any);
      res.json({ success: true, message: "Users retrieved", data: result.users, errors: null, meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await service.update(param(req, "id"), req.body);
      res.json({ success: true, message: "User updated", data: user, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.delete(param(req, "id"));
      res.json({ success: true, message: "User deleted", data: null, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const user = await service.findById(authReq.user!.id);
      res.json({ success: true, message: "Profile retrieved", data: user, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const user = await service.update(authReq.user!.id, req.body);
      res.json({ success: true, message: "Profile updated", data: user, errors: null, meta: null });
    } catch (error) {
      next(error);
    }
  };
}
