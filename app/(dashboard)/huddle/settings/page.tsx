"use client";

import { useEffect, useState } from "react";
import { loadEnv } from "@/lib/env";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
        Huddle settings are managed in the Huddle application.
      </p>

      <div className="n2p-keep-white bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-6">
          <Button
            variant="primary"
            icon={<Video className="w-4 h-4" />}
            onClick={() => window.open(huddleUrl, "_blank", "noopener,noreferrer")}
          >
            Open Huddle →
          </Button>
        </div>
      </div>
    </div>
  );
}
