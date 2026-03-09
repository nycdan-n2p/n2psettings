"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { Video } from "lucide-react";

const DEFAULT_HUDDLE_URL = "https://huddle.net2phone.com";

export default function HuddleSettingsPage() {
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
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Huddle Settings</h1>
      <p className="text-gray-600 mb-6">
        Video conferencing settings are managed in the Huddle application.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <a
            href={huddleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            <Video className="w-4 h-4" />
            Open Huddle →
          </a>
        </div>
      </div>
    </div>
  );
}
