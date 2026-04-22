"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";

type Message = {
  id: string;
  userId: string;
  email: string;
  message: string;
  createdAt: string;
};

export default function ChatBubble() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastSeen, setLastSeen] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  async function fetchMessages(silent = false) {
    const res = await fetch("/api/chat");
    if (!res.ok) return;
    const data: Message[] = await res.json();
    setMessages(data);
    if (!silent && !open) {
      const newMsgs = data.filter(
        (m) => m.userId !== user?.id && m.createdAt > lastSeen
      );
      if (newMsgs.length > 0) setUnread((n) => n + newMsgs.length);
    }
    if (data.length > 0) setLastSeen(data[data.length - 1].createdAt);
  }

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(), 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open, messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;

    setInput("");
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId, userId: user.id, email: user.email,
      message: text, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email, message: text }),
    });
    if (res.ok) {
      await fetchMessages(true);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    }
    setSending(false);
  }

  function formatTime(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">

      {/* Panel chat */}
      {open && (
        <div className="w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-3xl shadow-2xl ring-1 ring-slate-100 flex flex-col overflow-hidden"
          style={{ height: "min(480px, calc(100dvh - 120px))" }}>

          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base">💬</div>
              <div>
                <p className="text-white font-bold text-sm">Chat général</p>
                <p className="text-white/70 text-xs">{messages.length} messages</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors text-lg leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <span className="text-3xl">👋</span>
                <p className="text-slate-500 text-sm font-medium">Aucun message pour l&apos;instant</p>
                <p className="text-slate-400 text-xs">Sois le premier à briser la glace !</p>
              </div>
            )}

            {messages.map((m) => {
              const isMe = m.userId === user?.id;
              const email = m.email ?? "";
              const initiale = email[0]?.toUpperCase() ?? "?";
              return (
                <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 ${
                    isMe ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-slate-400 to-slate-500"
                  }`}>
                    {initiale}
                  </div>
                  <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-slate-400 px-1">
                      {isMe ? "Vous" : (email.split("@")[0] || "?")} · {formatTime(m.createdAt)}
                    </span>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isMe
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                    }`}>
                      {m.message}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100">
            {user ? (
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Écris un message…"
                  maxLength={300}
                  disabled={sending}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-[0.95] disabled:opacity-40 transition-all text-white w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                >
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <span className="text-base">↑</span>}
                </button>
              </form>
            ) : (
              <p className="text-center text-xs text-slate-400 py-1">
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Connecte-toi
                </Link>{" "}pour participer au chat
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 active:scale-[0.95] ${
          open
            ? "bg-slate-700 hover:bg-slate-800"
            : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:shadow-xl hover:scale-[1.08]"
        }`}
      >
        <span className="text-2xl">{open ? "✕" : "💬"}</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
