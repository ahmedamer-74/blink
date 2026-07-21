import { NotFoundError, ForbiddenError, ConflictError } from "@repo/utils";
import { RoomsRepository } from "./rooms.repository.js";
import { prisma } from "@repo/database";

const GROUP_SIZE_LIMIT = 256;

export class RoomsService {
  private repo = new RoomsRepository();

  async create(userId: string, data: { name?: string; isPrivate?: boolean; memberIds?: string[] }) {
    return this.repo.create(data, userId);
  }

  async findById(id: string) {
    const room = await this.repo.findById(id);
    if (!room) throw new NotFoundError("Room");
    return room;
  }

  async findUserRooms(userId: string) {
    return this.repo.findUserRooms(userId);
  }

  async findPendingRequests(userId: string) {
    return this.repo.findPendingRequests(userId);
  }

  async accept(roomId: string, userId: string) {
    const room = await this.repo.findById(roomId);
    if (!room) throw new NotFoundError("Room");
    const result = await this.repo.acceptMembership(roomId, userId);
    if (result.count === 0) throw new NotFoundError("Pending request");
    return { roomId, userId, status: "accepted" };
  }

  async reject(roomId: string, userId: string) {
    const room = await this.repo.findById(roomId);
    if (!room) throw new NotFoundError("Room");
    const result = await this.repo.rejectMembership(roomId, userId);
    if (result.count === 0) throw new NotFoundError("Pending request");
    return { roomId, userId };
  }

  async join(roomId: string, userId: string) {
    const room = await this.repo.findById(roomId);
    if (!room) throw new NotFoundError("Room");

    const isMember = await this.repo.isMember(roomId, userId);
    if (isMember) throw new ConflictError("Already a member");

    return this.repo.addMember(roomId, userId);
  }

  async leave(roomId: string, userId: string) {
    const isMember = await this.repo.isMember(roomId, userId);
    if (!isMember) throw new NotFoundError("Membership");

    return this.repo.removeMember(roomId, userId);
  }

  async delete(id: string, userId: string) {
    const room = await this.repo.findById(id);
    if (!room) throw new NotFoundError("Room");

    const membership = room.memberships.find((m) => m.userId === userId);
    if (!membership || membership.role !== "owner") {
      throw new ForbiddenError("Only the owner can delete a room");
    }

    return this.repo.delete(id);
  }

  // ==================== GROUP OPERATIONS ====================

  async createGroup(
    creatorId: string,
    data: { name: string; description?: string; avatarUrl?: string; memberIds?: string[] }
  ) {
    // Create the room
    const room = await prisma.room.create({
      data: {
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        isPrivate: false,
      },
    });

    // Add creator as owner
    await prisma.roomMembership.create({
      data: {
        userId: creatorId,
        roomId: room.id,
        role: "owner",
        status: "accepted",
      },
    });

    // Add other members
    const allMemberIds = data.memberIds || [];
    const uniqueMemberIds = [...new Set(allMemberIds.filter((id) => id !== creatorId))];

    if (uniqueMemberIds.length > 0) {
      // Check group size limit
      if (1 + uniqueMemberIds.length > GROUP_SIZE_LIMIT) {
        throw new ForbiddenError(`Group size limit is ${GROUP_SIZE_LIMIT} members`);
      }

      await prisma.roomMembership.createMany({
        data: uniqueMemberIds.map((userId) => ({
          userId,
          roomId: room.id,
          role: "member",
          status: "accepted",
        })),
      });
    }

    // Create system message
    await prisma.message.create({
      data: {
        content: `Group "${data.name}" created`,
        type: "system",
        userId: creatorId,
        roomId: room.id,
        systemMeta: {
          action: "create",
          actorId: creatorId,
        },
      },
    });

    return this.repo.findById(room.id);
  }

  async updateGroupInfo(
    roomId: string,
    userId: string,
    data: { name?: string; description?: string; avatarUrl?: string }
  ) {
    // Check if user is admin
    const membership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });

    if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
      throw new ForbiddenError("Only admins can update group info");
    }

    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });

    // Create system message for name change
    if (data.name) {
      await prisma.message.create({
        data: {
          content: `Group name changed to "${data.name}"`,
          type: "system",
          userId,
          roomId,
          systemMeta: {
            action: "rename",
            actorId: userId,
          },
        },
      });
    }

    return room;
  }

  async addMembers(roomId: string, adminId: string, userIds: string[]) {
    // Check if user is admin
    const adminMembership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId: adminId, roomId } },
    });

    if (!adminMembership || (adminMembership.role !== "admin" && adminMembership.role !== "owner")) {
      throw new ForbiddenError("Only admins can add members");
    }

    // Check group size limit
    const currentMemberCount = await prisma.roomMembership.count({
      where: { roomId },
    });

    if (currentMemberCount + userIds.length > GROUP_SIZE_LIMIT) {
      throw new ForbiddenError(`Group size limit is ${GROUP_SIZE_LIMIT} members`);
    }

    // Add members
    const addedUsers = [];
    for (const userId of userIds) {
      try {
        const membership = await prisma.roomMembership.upsert({
          where: {
            userId_roomId: { userId, roomId },
          },
          create: {
            userId,
            roomId,
            role: "member",
            status: "accepted",
          },
          update: {
            status: "accepted",
          },
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });
        addedUsers.push(membership.user);

        // Create system message for each added member
        await prisma.message.create({
          data: {
            content: `${membership.user.username} was added to the group`,
            type: "system",
            userId: adminId,
            roomId,
            systemMeta: {
              action: "add",
              actorId: adminId,
              targetId: userId,
            },
          },
        });
      } catch (error) {
        // Skip if user doesn't exist
        continue;
      }
    }

    return addedUsers;
  }

  async removeMember(roomId: string, adminId: string, targetUserId: string) {
    // Check if user is admin
    const adminMembership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId: adminId, roomId } },
    });

    if (!adminMembership || (adminMembership.role !== "admin" && adminMembership.role !== "owner")) {
      throw new ForbiddenError("Only admins can remove members");
    }

    // Cannot remove owner
    const targetMembership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId: targetUserId, roomId } },
    });

    if (!targetMembership) {
      throw new NotFoundError("Membership");
    }

    if (targetMembership.role === "owner") {
      throw new ForbiddenError("Cannot remove the group owner");
    }

    // Remove member
    await prisma.roomMembership.delete({
      where: {
        userId_roomId: { userId: targetUserId, roomId },
      },
    });

    // Create system message
    await prisma.message.create({
      data: {
        content: `A member was removed from the group`,
        type: "system",
        userId: adminId,
        roomId,
        systemMeta: {
          action: "remove",
          actorId: adminId,
          targetId: targetUserId,
        },
      },
    });

    return { userId: targetUserId };
  }

  async promoteAdmin(roomId: string, adminId: string, targetUserId: string) {
    // Check if user is admin
    const adminMembership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId: adminId, roomId } },
    });

    if (!adminMembership || (adminMembership.role !== "admin" && adminMembership.role !== "owner")) {
      throw new ForbiddenError("Only admins can promote members");
    }

    // Promote member
    await prisma.roomMembership.updateMany({
      where: {
        roomId,
        userId: targetUserId,
        role: { not: "owner" },
      },
      data: {
        role: "admin",
      },
    });

    // Create system message
    await prisma.message.create({
      data: {
        content: `A member was promoted to admin`,
        type: "system",
        userId: adminId,
        roomId,
        systemMeta: {
          action: "promote",
          actorId: adminId,
          targetId: targetUserId,
        },
      },
    });

    return { userId: targetUserId };
  }

  async demoteAdmin(roomId: string, adminId: string, targetUserId: string) {
    // Check if user is admin
    const adminMembership = await prisma.roomMembership.findUnique({
      where: { userId_roomId: { userId: adminId, roomId } },
    });

    if (!adminMembership || (adminMembership.role !== "admin" && adminMembership.role !== "owner")) {
      throw new ForbiddenError("Only admins can demote admins");
    }

    // Demote admin (but not owner)
    await prisma.roomMembership.updateMany({
      where: {
        roomId,
        userId: targetUserId,
        role: { not: "owner" },
      },
      data: {
        role: "member",
      },
    });

    // Create system message
    await prisma.message.create({
      data: {
        content: `An admin was demoted to member`,
        type: "system",
        userId: adminId,
        roomId,
        systemMeta: {
          action: "demote",
          actorId: adminId,
          targetId: targetUserId,
        },
      },
    });

    return { userId: targetUserId };
  }

  async getGroupMembers(roomId: string) {
    return prisma.roomMembership.findMany({
      where: { roomId },
      include: {
        user: {
          select: { id: true, username: true, avatar: true, email: true },
        },
      },
      orderBy: [
        { role: "asc" }, // owner first, then admin, then member
        { joinedAt: "asc" },
      ],
    });
  }

  async updateMuteStatus(roomId: string, userId: string, mutedUntil: Date | null) {
    return prisma.roomMembership.update({
      where: {
        userId_roomId: { userId, roomId },
      },
      data: {
        mutedUntil,
      },
    });
  }
}
