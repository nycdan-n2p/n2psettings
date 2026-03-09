"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";

export default function CalendarPage() {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    loadEnv().then((env) => {
      if (env.N2P_API_PROFILE_SETTINGS) {
        setProfileUrl(env.N2P_API_PROFILE_SETTINGS);
      }
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Calendar</h1>
      <p className="text-gray-600 mb-6">
        Calendar integration settings. Connect your calendar for availability and scheduling.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Calendar Integration</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            Calendar settings are managed in your profile. Connect Google Calendar, Outlook, or other providers.
          </p>
          {profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
            >
              Open Profile Settings →
            </a>
          ) : (
            <p className="text-sm text-gray-500">
              Profile settings URL not configured. Contact support for calendar integration.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
