"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { ProductHeader } from "@/components/layout/ProductHeader";

const DEFAULT_HUDDLE_URL = "https://huddle.net2phone.com";

export default function HuddleProductPage() {
  const t = useTranslations("productPages");
  const [huddleUrl, setHuddleUrl] = useState(DEFAULT_HUDDLE_URL);

  useEffect(() => {
    loadEnv().then((env) => {
      if (env.N2P_HUDDLE_URL) {
        setHuddleUrl(env.N2P_HUDDLE_URL);
      }
    });
  }, []);

  return (
    <div>
      <ProductHeader
        productId="huddle"
        status={t("statusOnForEveryone")}
      />
      <p className="text-gray-600 mb-6">
        {t("huddleSubtitle")}
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Huddle Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            Huddle video settings are managed in the Huddle application.
          </p>
          <a
            href={huddleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Open Huddle →
          </a>
        </div>
      </div>
    </div>
  );
}
