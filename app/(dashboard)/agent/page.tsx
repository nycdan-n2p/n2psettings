"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { ProductHeader } from "@/components/layout/ProductHeader";

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

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">AI Agent Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            The AI Agent is managed in a separate application. Click below to open the Agent portal.
          </p>
          <a
            href={agentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Open AI Agent →
          </a>
        </div>
      </div>
    </div>
  );
}
