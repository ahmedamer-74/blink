import { prisma } from "@repo/database";

export class AuthRepository {
  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  async createUser(data: { email: string; username: string; password: string }) {
    return prisma.user.create({ data });
  }

  async storeRefreshToken(token: string, userId: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  async deleteRefreshToken(token: string) {
    return prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteUserRefreshTokens(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
