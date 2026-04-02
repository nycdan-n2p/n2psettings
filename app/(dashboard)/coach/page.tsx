"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { ProductHeader } from "@/components/layout/ProductHeader";

const DEFAULT_COACH_URL = "https://coachai.net2phone.com";

export default function CoachProductPage() {
  const t = useTranslations("productPages");
  const [coachUrl, setCoachUrl] = useState(DEFAULT_COACH_URL);

  useEffect(() => {
    loadEnv().then((env) => {
      if (env.N2P_COACH_URL) {
        setCoachUrl(env.N2P_COACH_URL);
      }
    });
  }, []);

  return (
    <div>
      <ProductHeader
        productId="coach"
        status={t("statusOnForEveryone")}
      />
      <p className="text-gray-600 mb-6">
        {t("coachSubtitle")}
      </p>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Coach Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            Coach AI settings are managed in the Coach application.
          </p>
          <a
            href={coachUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Open Coach →
          </a>
        </div>
      </div>
    </div>
  );
}
