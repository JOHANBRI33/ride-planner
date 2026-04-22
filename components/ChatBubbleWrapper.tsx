"use client";

import dynamic from "next/dynamic";

const ChatBubble = dynamic(() => import("@/components/ChatBubble"), { ssr: false });

export default function ChatBubbleWrapper() {
  return <ChatBubble />;
}
