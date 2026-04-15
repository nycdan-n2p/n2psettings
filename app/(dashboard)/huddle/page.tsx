"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Button } from "@/components/ui/Button";

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

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-white">
          <h2 className="text-lg font-medium text-gray-900">Huddle Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            Huddle settings are managed in the Huddle application.
          </p>
          <Button
            variant="primary"
            onClick={() => window.open(huddleUrl, "_blank", "noopener,noreferrer")}
          >
            Open Huddle →
          </Button>
        </div>
      </div>
    </div>
  );
}
