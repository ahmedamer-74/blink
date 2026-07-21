import { prisma } from "@repo/database";

export class MessagesRepository {
  async create(data: { content: string; type?: string; userId: string; roomId: string }) {
    return prisma.message.create({
      data,
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
  }

  async findByRoom(roomId: string, page: number, limit: number) {
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { roomId },
        include: { user: { select: { id: true, username: true, avatar: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.message.count({ where: { roomId } }),
    ]);
    return { messages, total };
  }

  async findById(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
  }

  async update(id: string, content: string) {
    return prisma.message.update({
      where: { id },
      data: { content },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
  }

  async delete(id: string) {
    return prisma.message.delete({ where: { id } });
  }

  async search(roomId: string, query: string, limit: number) {
    // Use ILIKE for search (can upgrade to tsvector later)
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        content: { contains: query, mode: "insensitive" },
        deletedForEveryone: false,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return messages.map((msg) => ({
      ...msg,
      highlight: msg.content.replace(
        new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
        "<mark>$1</mark>"
      ),
    }));
  }

  async findStarred(userId: string, limit: number) {
    return prisma.starredMessage.findMany({
      where: { userId },
      include: {
        message: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
            room: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
