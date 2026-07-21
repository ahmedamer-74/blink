import { hashPassword, comparePassword, generateTokenPair } from "@repo/auth";
import { ConflictError, AuthError } from "@repo/utils";
import type { UserRole } from "@repo/types";
import { AuthRepository } from "./auth.repository.js";
import type { RegisterInput, LoginInput, AuthResponse } from "./auth.types.js";

export class AuthService {
  private repo = new AuthRepository();

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingEmail = await this.repo.findUserByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError("Email already registered");
    }

    const existingUsername = await this.repo.findUserByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError("Username already taken");
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await this.repo.createUser({
      email: input.email,
      username: input.username,
      password: hashedPassword,
    });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.repo.storeRefreshToken(tokens.refreshToken, user.id, expiresAt);

    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role as UserRole },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new AuthError("Invalid email or password");
    }

    const isValid = await comparePassword(input.password, user.password);
    if (!isValid) {
      throw new AuthError("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new AuthError("Account is not active");
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.repo.storeRefreshToken(tokens.refreshToken, user.id, expiresAt);

    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role as UserRole },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.repo.findRefreshToken(refreshToken);
    if (!stored) {
      throw new AuthError("Invalid refresh token");
    }

    await this.repo.deleteRefreshToken(refreshToken);

    const parts = refreshToken.split(".");
    const payloadSegment = parts[1];
    if (!payloadSegment) throw new AuthError("Invalid refresh token format");
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64").toString());

    const user = await this.repo.findUserById(payload.sub);
    if (!user) {
      throw new AuthError("User not found");
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.repo.storeRefreshToken(tokens.refreshToken, user.id, expiresAt);

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(userId: string) {
    await this.repo.deleteUserRefreshTokens(userId);
  }
}
