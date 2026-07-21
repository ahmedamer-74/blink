"use server";

import type { Room } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function createRoomAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | { success: true; room: Room }> {
  // This action is no longer used — new conversation page does client-side fetch
  return { error: "Use client-side fetch instead" };
}

export async function getUserRoomsAction() {
  // This action is no longer used — ConversationList does client-side fetch
  return [];
}

export async function joinRoomAction(_roomId: string) {
  // This action is no longer used — new conversation page does client-side fetch
  return { error: "Use client-side fetch instead" };
}
