import { NotFoundError, ForbiddenError } from "@repo/utils";
import { MessagesRepository } from "./messages.repository.js";
import { buildPaginationMeta } from "@repo/utils";
import { prisma } from "@repo/database";

export class MessagesService {
  private repo = new MessagesRepository();

  async send(userId: string, roomId: string, content: string, type = "text") {
    const membership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership || membership.status !== "accepted") {
      throw new ForbiddenError("You must be an accepted member to send messages");
    }
    return this.repo.create({ content, type, userId, roomId });
  }

  async findByRoom(roomId: string, userId: string, page: number, limit: number) {
    const membership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership || membership.status !== "accepted") {
      throw new ForbiddenError("You must be an accepted member to view messages");
    }
    const { messages, total } = await this.repo.findByRoom(roomId, page, limit);
    return { messages, meta: buildPaginationMeta(total, page, limit) };
  }

  async update(id: string, userId: string, content: string) {
    const message = await this.repo.findById(id);
    if (!message) throw new NotFoundError("Message");
    if (message.userId !== userId) throw new ForbiddenError("Not your message");
    return this.repo.update(id, content);
  }

  async delete(id: string, userId: string) {
    const message = await this.repo.findById(id);
    if (!message) throw new NotFoundError("Message");
    if (message.userId !== userId) throw new ForbiddenError("Not your message");
    return this.repo.delete(id);
  }

  async search(roomId: string, userId: string, query: string, limit: number) {
    const membership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership || membership.status !== "accepted") {
      throw new ForbiddenError("You must be an accepted member to search messages");
    }
    return this.repo.search(roomId, query, limit);
  }

  async getStarred(userId: string, limit: number) {
    return this.repo.findStarred(userId, limit);
  }
}
