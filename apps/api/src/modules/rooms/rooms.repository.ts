import { prisma } from "@repo/database";

export class RoomsRepository {
  async create(data: { name?: string; isPrivate?: boolean; memberIds?: string[] }, userId: string) {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.create({ data: { name: data.name, isPrivate: data.isPrivate } });
      await tx.roomMembership.create({
        data: { userId, roomId: room.id, role: "owner", status: "accepted" },
      });
      if (data.memberIds?.length) {
        for (const memberId of data.memberIds) {
          await tx.roomMembership.create({
            data: { userId: memberId, roomId: room.id, role: "member", status: "pending" },
          });
        }
      }
      return room;
    });
  }

  async findById(id: string) {
    return prisma.room.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
        },
      },
    });
  }

  async findUserRooms(userId: string) {
    return prisma.room.findMany({
      where: { memberships: { some: { userId, status: "accepted" } } },
      include: {
        memberships: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findPendingRequests(userId: string) {
    return prisma.room.findMany({
      where: { memberships: { some: { userId, status: "pending" } } },
      include: {
        memberships: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptMembership(roomId: string, userId: string) {
    return prisma.roomMembership.updateMany({
      where: { roomId, userId, status: "pending" },
      data: { status: "accepted" },
    });
  }

  async rejectMembership(roomId: string, userId: string) {
    return prisma.roomMembership.deleteMany({
      where: { roomId, userId, status: "pending" },
    });
  }

  async addMember(roomId: string, userId: string, role = "member") {
    return prisma.roomMembership.create({ data: { roomId, userId, role, status: "accepted" } });
  }

  async removeMember(roomId: string, userId: string) {
    return prisma.roomMembership.deleteMany({ where: { roomId, userId } });
  }

  async isMember(roomId: string, userId: string) {
    const membership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    return !!membership;
  }

  async delete(id: string) {
    return prisma.room.delete({ where: { id } });
  }
}
