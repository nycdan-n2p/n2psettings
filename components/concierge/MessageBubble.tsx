"use client";

import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type MessageRole = "concierge" | "user";

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  isTyping?: boolean;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#1a73e8] opacity-60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

// ── Individual bubble ─────────────────────────────────────────────────────────

export function MessageBubble({ message }: { message: Message }) {
  const isConcierge = message.role === "concierge";

  if (isConcierge) {
    return (
      <div className="flex items-start gap-3 mb-4">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>

        {/* Bubble */}
        <div className="max-w-[85%] bg-white border border-[#e8eaed] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          {message.isTyping ? (
            <TypingDots />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800 [&_table]:w-full [&_table]:text-xs [&_th]:bg-[#f8f9fa] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-600 [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-[#f1f3f4] [&_table]:border [&_table]:border-[#e8eaed] [&_table]:rounded-lg [&_table]:overflow-hidden [&_strong]:text-gray-900 [&_p]:mb-2 last:[&_p]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  // User bubble — right-aligned
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[75%] bg-[#1a73e8] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
}

// ── Message list ──────────────────────────────────────────────────────────────

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
