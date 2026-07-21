import { prisma } from "@repo/database";

export class UsersRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id }, omit: { password: true } });
  }

  async search(query: string) {
    if (!query.trim()) return [];
    return prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      omit: { password: true },
      take: 20,
    });
  }

  async findAll(page: number, limit: number) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        omit: { password: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);
    return { users, total };
  }

  async update(id: string, data: { email?: string; username?: string; avatar?: string }) {
    return prisma.user.update({ where: { id }, data, omit: { password: true } });
  }

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }
}
