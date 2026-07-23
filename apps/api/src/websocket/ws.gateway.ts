import type { AuthenticatedSocket } from "./ws.types.js";
import { parseMessage, createMessage, createErrorMessage } from "@repo/websocket";
import { presenceManager } from "./ws.presence.js";
import { roomManager } from "./ws.rooms.js";
import { prisma } from "@repo/database";
import { logger } from "@repo/logger";
import { isPushConfigured, sendPushNotification } from "../lib/push.js";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function isAcceptedMember(roomId: string, userId: string): Promise<boolean> {
  const membership = await prisma.roomMembership.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return !!membership && membership.status === "accepted";
}

async function isAdmin(roomId: string, userId: string): Promise<boolean> {
  const membership = await prisma.roomMembership.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return !!membership && (membership.role === "admin" || membership.role === "owner");
}

/**
 * Send push notifications to room members who are NOT currently connected via WebSocket.
 */
async function notifyOfflineMembers(
  roomId: string,
  senderId: string,
  senderUsername: string,
  content: string,
  type: string,
) {
  if (!isPushConfigured()) return;

  // Get all accepted members of the room
  const memberships = await prisma.roomMembership.findMany({
    where: { roomId, status: "accepted" },
    select: { userId: true },
  });

  const memberIds = memberships.map((m) => m.userId).filter((id) => id !== senderId);
  if (memberIds.length === 0) return;

  // Find which members are NOT connected to any WebSocket in this room
  const roomSockets = roomManager.getRoomSockets(roomId);
  const connectedUserIds = new Set(
    roomSockets.map((s) => s.userId).filter(Boolean),
  );

  const offlineUserIds = memberIds.filter((id) => !connectedUserIds.has(id));
  if (offlineUserIds.length === 0) return;

  // Get push subscriptions for offline users
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: offlineUserIds } },
  });

  if (subscriptions.length === 0) return;

  const displayContent = type === "text"
    ? content.slice(0, 100)
    : `[${type}]`;

  const payload = JSON.stringify({
    title: senderUsername,
    body: displayContent,
    roomId,
    type: "message",
  });

  // Send to all subscriptions (don't await — fire and forget)
  const staleEndpoints: string[] = [];
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const ok = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      if (!ok) staleEndpoints.push(sub.endpoint);
    }),
  );

  // Clean up expired subscriptions
  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
  }
}

export async function handleMessage(socket: AuthenticatedSocket, raw: string) {
  const message = parseMessage(raw);
  if (!message) {
    socket.send(JSON.stringify(createErrorMessage("INVALID_MESSAGE", "Invalid message format")));
    return;
  }

  switch (message.event) {
    // ==================== MESSAGE EVENTS ====================
    
    case "message:send": {
      const data = message.data as {
        roomId: string;
        content: string;
        type?: string;
        replyToMessageId?: string;
        forwardedFromId?: string;
        mediaUrl?: string;
        mediaMeta?: Record<string, unknown>;
      };
      
      if (socket.userId && !(await isAcceptedMember(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You must be an accepted member")));
        return;
      }

      // TODO: Add blocked user check after running migrations
      // For now, skip this check until the blocked_users table exists

      // Persist message to database
      const savedMessage = await prisma.message.create({
        data: {
          content: data.content,
          type: data.type || "text",
          userId: socket.userId!,
          roomId: data.roomId,
          replyToMessageId: data.replyToMessageId,
          forwardedFromId: data.forwardedFromId,
          mediaUrl: data.mediaUrl,
          mediaMeta: data.mediaMeta as any,
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });

      const broadcastMsg = createMessage("message:new", {
        roomId: data.roomId,
        message: {
          id: savedMessage.id,
          content: savedMessage.content,
          type: savedMessage.type,
          userId: savedMessage.userId,
          username: (savedMessage as any).user.username,
          createdAt: savedMessage.createdAt.toISOString(),
          replyToMessageId: savedMessage.replyToMessageId,
          forwardedFromId: savedMessage.forwardedFromId,
          mediaUrl: savedMessage.mediaUrl,
          mediaMeta: savedMessage.mediaMeta,
        },
      });
      roomManager.broadcast(data.roomId, broadcastMsg);

      // Send push notifications to offline room members
      notifyOfflineMembers(
        data.roomId,
        socket.userId!,
        socket.username!,
        data.content,
        data.type || "text",
      ).catch((err) => logger.error({ err }, "Push notification error"));

      break;
    }

    case "message:edit": {
      const data = message.data as { messageId: string; content: string };
      
      const messageToEdit = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      
      if (!messageToEdit) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message not found")));
        return;
      }
      
      if (messageToEdit.userId !== socket.userId) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You can only edit your own messages")));
        return;
      }
      
      // Check 15-minute edit window
      const editDeadline = new Date(messageToEdit.createdAt.getTime() + EDIT_WINDOW_MS);
      if (new Date() > editDeadline) {
        socket.send(JSON.stringify(createErrorMessage("TIME_LIMIT", "Message can only be edited within 15 minutes")));
        return;
      }

      const updatedMessage = await prisma.message.update({
        where: { id: data.messageId },
        data: {
          content: data.content,
          editedAt: new Date(),
        },
      });

      const editMsg = createMessage("message:edited", {
        roomId: messageToEdit.roomId,
        messageId: data.messageId,
        content: data.content,
        editedAt: updatedMessage.editedAt!.toISOString(),
      });
      roomManager.broadcast(messageToEdit.roomId, editMsg);
      break;
    }

    case "message:delete_for_me": {
      const data = message.data as { messageId: string };
      
      const messageToDelete = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      
      if (!messageToDelete) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message not found")));
        return;
      }

      // Add userId to deletedFor array
      await prisma.message.update({
        where: { id: data.messageId },
        data: {
          deletedFor: {
            push: socket.userId!,
          },
        },
      });
      
      // No broadcast needed - this is a personal action
      break;
    }

    case "message:delete_for_everyone": {
      const data = message.data as { messageId: string; roomId: string };
      
      const messageToDelete = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      
      if (!messageToDelete) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message not found")));
        return;
      }
      
      if (messageToDelete.userId !== socket.userId) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You can only delete your own messages")));
        return;
      }
      
      // Check 15-minute delete window
      const deleteDeadline = new Date(messageToDelete.createdAt.getTime() + EDIT_WINDOW_MS);
      if (new Date() > deleteDeadline) {
        socket.send(JSON.stringify(createErrorMessage("TIME_LIMIT", "Message can only be deleted within 15 minutes")));
        return;
      }

      await prisma.message.update({
        where: { id: data.messageId },
        data: {
          deletedForEveryone: true,
          content: "This message has been deleted",
        },
      });

      const deleteMsg = createMessage("message:deleted_for_everyone", {
        roomId: data.roomId,
        messageId: data.messageId,
      });
      roomManager.broadcast(data.roomId, deleteMsg);
      break;
    }

    case "message:reply": {
      const data = message.data as {
        roomId: string;
        content: string;
        replyToMessageId: string;
        type?: string;
        mediaUrl?: string;
        mediaMeta?: Record<string, unknown>;
      };
      
      if (socket.userId && !(await isAcceptedMember(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You must be an accepted member")));
        return;
      }

      // Verify the message being replied to exists
      const replyToMessage = await prisma.message.findUnique({
        where: { id: data.replyToMessageId },
      });
      
      if (!replyToMessage) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message being replied to not found")));
        return;
      }

      // Save reply message
      const savedReply = await prisma.message.create({
        data: {
          content: data.content,
          type: data.type || "text",
          userId: socket.userId!,
          roomId: data.roomId,
          replyToMessageId: data.replyToMessageId,
          mediaUrl: data.mediaUrl,
          mediaMeta: data.mediaMeta as any,
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });

      const replyMsg = createMessage("message:new", {
        roomId: data.roomId,
        message: {
          id: savedReply.id,
          content: savedReply.content,
          type: savedReply.type,
          userId: savedReply.userId,
          username: (savedReply as any).user.username,
          createdAt: savedReply.createdAt.toISOString(),
          replyToMessageId: savedReply.replyToMessageId,
          mediaUrl: savedReply.mediaUrl,
          mediaMeta: savedReply.mediaMeta,
        },
      });
      roomManager.broadcast(data.roomId, replyMsg);

      notifyOfflineMembers(
        data.roomId,
        socket.userId!,
        socket.username!,
        data.content,
        data.type || "text",
      ).catch((err) => logger.error({ err }, "Push notification error"));

      break;
    }

    case "message:forward": {
      const data = message.data as { messageId: string; targetRoomIds: string[] };
      
      const originalMessage = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      
      if (!originalMessage) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message not found")));
        return;
      }

      // Forward to each target room
      for (const targetRoomId of data.targetRoomIds) {
        if (socket.userId && !(await isAcceptedMember(targetRoomId, socket.userId))) {
          continue; // Skip rooms where user is not a member
        }

        const forwardedMsg = await prisma.message.create({
          data: {
            content: originalMessage.content,
            type: originalMessage.type,
            userId: socket.userId!,
            roomId: targetRoomId,
            forwardedFromId: originalMessage.id,
            mediaUrl: originalMessage.mediaUrl,
            mediaMeta: originalMessage.mediaMeta as any,
          },
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        const broadcastMsg = createMessage("message:new", {
          roomId: targetRoomId,
          message: {
            id: forwardedMsg.id,
            content: forwardedMsg.content,
            type: forwardedMsg.type,
            userId: forwardedMsg.userId,
            username: (forwardedMsg as any).user.username,
            createdAt: forwardedMsg.createdAt.toISOString(),
            forwardedFromId: forwardedMsg.forwardedFromId,
            mediaUrl: forwardedMsg.mediaUrl,
            mediaMeta: forwardedMsg.mediaMeta,
          },
        });
        roomManager.broadcast(targetRoomId, broadcastMsg);
      }
      break;
    }

    case "message:star": {
      const data = message.data as { messageId: string };
      
      const messageToStar = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      
      if (!messageToStar) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Message not found")));
        return;
      }

      // Create starred message record (ignore if already starred)
      await prisma.starredMessage.upsert({
        where: {
          userId_messageId: {
            userId: socket.userId!,
            messageId: data.messageId,
          },
        },
        create: {
          userId: socket.userId!,
          messageId: data.messageId,
        },
        update: {},
      });

      const starMsg = createMessage("message:starred", {
        messageId: data.messageId,
      });
      socket.send(JSON.stringify(starMsg));
      break;
    }

    case "message:unstar": {
      const data = message.data as { messageId: string };
      
      await prisma.starredMessage.deleteMany({
        where: {
          userId: socket.userId!,
          messageId: data.messageId,
        },
      });

      const unstarMsg = createMessage("message:unstarred", {
        messageId: data.messageId,
      });
      socket.send(JSON.stringify(unstarMsg));
      break;
    }

    case "message:read": {
      const data = message.data as { roomId: string; lastMessageId: string };
      
      const readMsg = createMessage("message:read", {
        roomId: data.roomId,
        userId: socket.userId!,
        lastMessageId: data.lastMessageId,
      });
      roomManager.broadcast(data.roomId, readMsg, socket.userId);
      break;
    }

    // ==================== ROOM EVENTS ====================
    
    case "room:join": {
      const data = message.data as { roomId: string };
      if (socket.userId && !(await isAcceptedMember(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You must be an accepted member")));
        return;
      }
      roomManager.joinRoom(socket, data.roomId);
      break;
    }

    case "room:leave": {
      const data = message.data as { roomId: string };
      roomManager.leaveRoom(socket, data.roomId);
      break;
    }

    case "room:create": {
      const data = message.data as { name?: string; isPrivate?: boolean; memberIds?: string[] };
      
      // Create room
      const room = await prisma.room.create({
        data: {
          name: data.name,
          isPrivate: data.isPrivate ?? false,
        },
      });

      // Add creator as owner
      await prisma.roomMembership.create({
        data: {
          userId: socket.userId!,
          roomId: room.id,
          role: "owner",
          status: "accepted",
        },
      });

      // Add other members
      if (data.memberIds && data.memberIds.length > 0) {
        const memberPromises = data.memberIds
          .filter((id) => id !== socket.userId)
          .map((userId) =>
            prisma.roomMembership.create({
              data: {
                userId,
                roomId: room.id,
                role: "member",
                status: "accepted",
              },
            })
          );
        await Promise.all(memberPromises);
      }

      const createdMsg = createMessage("room:created", { room });
      socket.send(JSON.stringify(createdMsg));
      break;
    }

    case "room:update": {
      const data = message.data as { roomId: string; name?: string; description?: string; avatarUrl?: string };
      
      if (socket.userId && !(await isAdmin(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "Only admins can update group info")));
        return;
      }

      const updatedRoom = await prisma.room.update({
        where: { id: data.roomId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        },
      });

      const updateMsg = createMessage("room:updated", {
        roomId: data.roomId,
        updates: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        },
      });
      roomManager.broadcast(data.roomId, updateMsg);
      break;
    }

    case "room:add_members": {
      const data = message.data as { roomId: string; userIds: string[] };
      
      if (socket.userId && !(await isAdmin(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "Only admins can add members")));
        return;
      }

      // Check group size limit (256 members)
      const currentMemberCount = await prisma.roomMembership.count({
        where: { roomId: data.roomId },
      });
      
      if (currentMemberCount + data.userIds.length > 256) {
        socket.send(JSON.stringify(createErrorMessage("LIMIT_EXCEEDED", "Group size limit reached (256 members)")));
        return;
      }

      const newMembers = await Promise.all(
        data.userIds.map((userId) =>
          prisma.roomMembership.upsert({
            where: {
              userId_roomId: { userId, roomId: data.roomId },
            },
            create: {
              userId,
              roomId: data.roomId,
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
          })
        )
      );

      const addMsg = createMessage("room:member_added", {
        roomId: data.roomId,
        users: newMembers.map((m) => m.user),
      });
      roomManager.broadcast(data.roomId, addMsg);
      break;
    }

    case "room:remove_member": {
      const data = message.data as { roomId: string; userId: string };
      
      if (socket.userId && !(await isAdmin(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "Only admins can remove members")));
        return;
      }

      await prisma.roomMembership.deleteMany({
        where: {
          roomId: data.roomId,
          userId: data.userId,
          role: { not: "owner" }, // Cannot remove owner
        },
      });

      const removeMsg = createMessage("room:member_removed", {
        roomId: data.roomId,
        userId: data.userId,
      });
      roomManager.broadcast(data.roomId, removeMsg);
      break;
    }

    case "room:promote_admin": {
      const data = message.data as { roomId: string; userId: string };
      
      if (socket.userId && !(await isAdmin(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "Only admins can promote members")));
        return;
      }

      await prisma.roomMembership.updateMany({
        where: {
          roomId: data.roomId,
          userId: data.userId,
        },
        data: {
          role: "admin",
        },
      });

      const promoteMsg = createMessage("room:admin_promoted", {
        roomId: data.roomId,
        userId: data.userId,
      });
      roomManager.broadcast(data.roomId, promoteMsg);
      break;
    }

    case "room:demote_admin": {
      const data = message.data as { roomId: string; userId: string };
      
      if (socket.userId && !(await isAdmin(data.roomId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "Only admins can demote admins")));
        return;
      }

      await prisma.roomMembership.updateMany({
        where: {
          roomId: data.roomId,
          userId: data.userId,
          role: { not: "owner" }, // Cannot demote owner
        },
        data: {
          role: "member",
        },
      });

      const demoteMsg = createMessage("room:admin_demoted", {
        roomId: data.roomId,
        userId: data.userId,
      });
      roomManager.broadcast(data.roomId, demoteMsg);
      break;
    }

    // ==================== CALL EVENTS ====================
    
    case "call:initiate": {
      const data = message.data as { conversationId: string; type: "voice" | "video" };
      
      if (socket.userId && !(await isAcceptedMember(data.conversationId, socket.userId))) {
        socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You must be an accepted member")));
        return;
      }

      // Create call record
      const call = await prisma.call.create({
        data: {
          conversationId: data.conversationId,
          initiatorId: socket.userId!,
          type: data.type,
        },
      });

      // Add initiator as participant
      await prisma.callParticipant.create({
        data: {
          callId: call.id,
          userId: socket.userId!,
        },
      });

      // Notify other members in the room
      const roomMembers = await prisma.roomMembership.findMany({
        where: { roomId: data.conversationId, status: "accepted" },
        include: { user: { select: { id: true, username: true } } },
      });

      for (const member of roomMembers) {
        if (member.userId !== socket.userId) {
          // Send call:incoming to each member (they'll need to handle SDP exchange)
          const incomingMsg = createMessage("call:incoming", {
            callId: call.id,
            conversationId: data.conversationId,
            callerId: socket.userId,
            callerUsername: socket.username,
            type: data.type,
            sdp: "", // Will be filled when caller sends offer
          });
          // This would need to be sent to specific user's sockets
          // For now, broadcast to room (simplified)
          roomManager.broadcast(data.conversationId, incomingMsg);
        }
      }
      break;
    }

    case "call:answer": {
      const data = message.data as { callId: string; sdp: string };
      
      const call = await prisma.call.findUnique({
        where: { id: data.callId },
      });
      
      if (!call) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Call not found")));
        return;
      }

      // Add answering user as participant
      await prisma.callParticipant.create({
        data: {
          callId: data.callId,
          userId: socket.userId!,
        },
      });

      const answerMsg = createMessage("call:answered", {
        callId: data.callId,
        sdp: data.sdp,
      });
      roomManager.broadcast(call.conversationId, answerMsg);
      break;
    }

    case "call:reject": {
      const data = message.data as { callId: string };
      
      const call = await prisma.call.findUnique({
        where: { id: data.callId },
      });
      
      if (!call) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Call not found")));
        return;
      }

      // End the call
      await prisma.call.update({
        where: { id: data.callId },
        data: {
          endedAt: new Date(),
        },
      });

      const rejectMsg = createMessage("call:rejected", {
        callId: data.callId,
      });
      roomManager.broadcast(call.conversationId, rejectMsg);
      break;
    }

    case "call:end": {
      const data = message.data as { callId: string };
      
      const call = await prisma.call.findUnique({
        where: { id: data.callId },
      });
      
      if (!call) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Call not found")));
        return;
      }

      const duration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);

      await prisma.call.update({
        where: { id: data.callId },
        data: {
          endedAt: new Date(),
          duration,
        },
      });

      const endMsg = createMessage("call:ended", {
        callId: data.callId,
        duration,
      });
      roomManager.broadcast(call.conversationId, endMsg);
      break;
    }

    case "call:ice_candidate": {
      const data = message.data as {
        callId: string;
        candidate: string;
        sdpMid?: string;
        sdpMLineIndex?: number;
      };
      
      const call = await prisma.call.findUnique({
        where: { id: data.callId },
      });
      
      if (!call) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Call not found")));
        return;
      }

      const iceMsg = createMessage("call:ice_candidate", {
        callId: data.callId,
        candidate: data.candidate,
        sdpMid: data.sdpMid,
        sdpMLineIndex: data.sdpMLineIndex,
      });
      roomManager.broadcast(call.conversationId, iceMsg, socket.userId);
      break;
    }

    // ==================== STATUS EVENTS ====================
    
    case "status:create": {
      const data = message.data as {
        type: "text" | "image" | "video";
        content?: string;
        mediaUrl?: string;
        caption?: string;
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const status = await prisma.status.create({
        data: {
          userId: socket.userId!,
          type: data.type,
          content: data.content,
          mediaUrl: data.mediaUrl,
          caption: data.caption,
          expiresAt,
        },
      });

      // Get user's contacts to notify them
      const contacts = await prisma.contact.findMany({
        where: { userId: socket.userId! },
        select: { contactId: true },
      });

      const statusMsg = createMessage("status:new", {
        statusId: status.id,
        userId: socket.userId!,
        username: socket.username!,
        type: data.type,
        createdAt: status.createdAt.toISOString(),
      });

      // Notify contacts (simplified - would need to send to specific users)
      for (const contact of contacts) {
        // This would need to be sent to the contact's connected sockets
        // For now, we'll just broadcast to the user's own socket
        socket.send(JSON.stringify(statusMsg));
      }
      break;
    }

    case "status:view": {
      const data = message.data as { statusId: string };
      
      const status = await prisma.status.findUnique({
        where: { id: data.statusId },
      });
      
      if (!status) {
        socket.send(JSON.stringify(createErrorMessage("NOT_FOUND", "Status not found")));
        return;
      }

      // Record the view
      await prisma.statusView.upsert({
        where: {
          statusId_viewerId: {
            statusId: data.statusId,
            viewerId: socket.userId!,
          },
        },
        create: {
          statusId: data.statusId,
          viewerId: socket.userId!,
        },
        update: {},
      });

      // Notify status owner
      const viewMsg = createMessage("status:viewed", {
        statusId: data.statusId,
        viewerId: socket.userId!,
      });
      // This would need to be sent to the status owner's sockets
      break;
    }

    // ==================== TYPING EVENTS ====================
    
    case "user:typing": {
      const data = message.data as { roomId: string };
      if (socket.userId) {
        presenceManager.setTyping(data.roomId, socket.userId);
        roomManager.broadcast(data.roomId, createMessage("user:typing", {
          roomId: data.roomId,
          userId: socket.userId,
        }), socket.userId);
      }
      break;
    }

    case "user:stop_typing": {
      const data = message.data as { roomId: string };
      if (socket.userId) {
        presenceManager.clearTyping(data.roomId, socket.userId);
      }
      break;
    }

    // ==================== PING ====================
    
    case "ping": {
      socket.send(JSON.stringify(createMessage("pong", {})));
      if (socket.userId) {
        presenceManager.refreshPresence(socket.userId, socket.userId);
      }
      break;
    }

    default:
      socket.send(JSON.stringify(createErrorMessage("UNKNOWN_EVENT", "Unknown event: " + message.event)));
  }
}
