"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { MessageThread } from "@/components/chat/message-thread";

export default function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const router = useRouter();

  return <MessageThread roomId={conversationId} onBack={() => router.push("/chat")} />;
}
