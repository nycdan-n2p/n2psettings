"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { Bot } from "lucide-react";

const DEFAULT_AGENT_URL = "https://agent.net2phone.com";

export default function AgentSettingsPage() {
  const [agentUrl, setAgentUrl] = useState(DEFAULT_AGENT_URL);

  useEffect(() => {
    loadEnv().then((env) => {
      if (env.N2P_AI_AGENT_URL) {
        setAgentUrl(env.N2P_AI_AGENT_URL);
      }
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">AI Agent Settings</h1>
      <p className="text-gray-600 mb-6">
        Configure your AI assistant. Settings are managed in the Agent application.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <a
            href={agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            <Bot className="w-4 h-4" />
            Open AI Agent →
          </a>
        </div>
      </div>
    </div>
  );
}
