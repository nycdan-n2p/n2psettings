"use client";

import { Bot, MessageCircle } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";

export default function OnboardingPage() {
  const { open } = useAssistant();

  return (
    <div className="max-w-lg mx-auto py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-[#e8f0fe] flex items-center justify-center mx-auto mb-6">
        <Bot className="w-8 h-8 text-[#1a73e8]" />
      </div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">N2P Assistant</h1>
      <p className="text-gray-600 mb-8">
        The assistant helps you add users, assign phone numbers, manage ring groups, call queues, departments, and pull call stats.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Open the assistant from the header icon or under <strong>Help</strong> in your profile dropdown.
      </p>
      <button
        onClick={open}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a73e8] text-white rounded-lg font-medium hover:bg-[#1557b0] transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        Open Assistant
      </button>
    </div>
  );
}
