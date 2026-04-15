"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

      <div className="n2p-keep-white bg-white !rounded-[32px] shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <Button
            variant="primary"
            icon={<Bot className="w-4 h-4" />}
            onClick={() => window.open(agentUrl, "_blank", "noopener,noreferrer")}
          >
            Open AI Agent →
          </Button>
        </div>
      </div>
    </div>
  );
}
