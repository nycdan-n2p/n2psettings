"use client";

import { useState } from "react";
import { Bot, X, RotateCcw } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { AssistantChat } from "./AssistantChat";

export function AssistantSidePanel() {
  const { isOpen, close } = useAssistant();
  const [chatKey, setChatKey] = useState(0);

  if (!isOpen) return null;

  const handleNewSession = () => {
    setChatKey((k) => k + 1);
  };

  return (
    <>
      {/* Backdrop for desktop click-outside */}
      <div
        className="fixed inset-0 bg-black/20 z-40 hidden md:block"
        onClick={close}
        aria-hidden="true"
      />

      {/* Side panel — full screen on mobile, capped drawer on md+ */}
      <div
        className="fixed top-0 right-0 h-full w-full md:max-w-md bg-white z-50 flex flex-col border-l border-[#e5e7eb] shadow-[-18px_0_32px_rgba(15,23,42,0.16)]"
        role="dialog"
        aria-label="N2P Sidekick"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-medium text-gray-900">N2P Sidekick</h2>
              <p className="text-xs text-gray-500">Create users, groups, queues, menus &amp; more</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewSession}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              title="New session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={close}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <AssistantChat key={chatKey} compact />
        </div>
      </div>
    </>
  );
}
