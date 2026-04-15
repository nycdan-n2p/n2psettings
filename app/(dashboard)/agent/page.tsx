"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Button } from "@/components/ui/Button";

const DEFAULT_AGENT_URL = "https://agent.net2phone.com";

export default function AgentProductPage() {
  const t = useTranslations("productPages");
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
      <ProductHeader
        productId="agent"
        status={t("statusOnForEveryone")}
      />
      <p className="text-gray-600 mb-6">
        {t("agentSubtitle")}
      </p>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-white">
          <h2 className="text-lg font-medium text-gray-900">AI Agent Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            The AI Agent is managed in a separate application. Click below to open the Agent portal.
          </p>
          <Button
            variant="primary"
            onClick={() => window.open(agentUrl, "_blank", "noopener,noreferrer")}
          >
            Open AI Agent →
          </Button>
        </div>
      </div>
    </div>
  );
}
