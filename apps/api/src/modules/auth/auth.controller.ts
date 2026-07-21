import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const service = new AuthService();

export class AuthController {
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.register(req.body);
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: result,
        errors: null,
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.login(req.body);
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({
        success: true,
        message: "Login successful",
        data: result,
        errors: null,
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      const result = await service.refresh(refreshToken);
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({
        success: true,
        message: "Token refreshed",
        data: { accessToken: result.accessToken },
        errors: null,
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (authReq.user) {
        await service.logout(authReq.user.id);
      }
      res.clearCookie("refreshToken");
      res.json({
        success: true,
        message: "Logged out",
        data: null,
        errors: null,
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };
}
