"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { GraduationCap } from "lucide-react";

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

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <a
            href={coachUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            <GraduationCap className="w-4 h-4" />
            Open Coach →
          </a>
        </div>
      </div>
    </div>
  );
}
