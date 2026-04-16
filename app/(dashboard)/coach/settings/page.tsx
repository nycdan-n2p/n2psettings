"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { GraduationCap } from "lucide-react";
import { getButtonClasses } from "@/components/ui/Button";

const DEFAULT_COACH_URL = "https://coachai.net2phone.com";

export default function CoachSettingsPage() {
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
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Coach Settings</h1>
      <p className="text-gray-600 mb-6">
        AI coaching settings are managed in the Coach application.
      </p>

      <div className="n2p-keep-white bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <a
            href={coachUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={getButtonClasses({ variant: "primary", size: "md" })}
          >
            <GraduationCap className="w-4 h-4" />
            Open Coach →
          </a>
        </div>
      </div>
    </div>
  );
}
