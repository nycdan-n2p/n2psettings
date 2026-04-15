"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";

export default function CalendarPage() {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const t = useTranslations("calendarPage");

  useEffect(() => {
    loadEnv().then((env) => {
      if (env.N2P_API_PROFILE_SETTINGS) setProfileUrl(env.N2P_API_PROFILE_SETTINGS);
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">{t("title")}</h1>
      <p className="text-gray-600 mb-6">{t("subtitle")}</p>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">{t("sectionTitle")}</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">{t("sectionDesc")}</p>
          {profileUrl ? (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">
              {t("openProfile")}
            </a>
          ) : (
            <p className="text-sm text-gray-500">{t("notConfigured")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
