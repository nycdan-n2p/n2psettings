"use client";

import { useApp } from "@/contexts/AppContext";
import { ExternalLink } from "lucide-react";

/**
 * SSO is configured via auth.net2phone.com SAML settings page.
 * There is no REST API for SSO config on app.net2phone.com.
 */
export function SsoSection() {
  const { bootstrap } = useApp();
  const clientId = bootstrap?.account?.clientId ?? 36422;
  const samlUrl = `https://auth.net2phone.com/saml/settings/${clientId}`;

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-600 mb-4">
        Allow team members to sign into net2phone using their corporate credentials.
        Configure your identity provider (IdP) settings below.
      </p>
      <a
        href={samlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
      >
        Open SAML SSO settings
        <ExternalLink className="w-4 h-4" />
      </a>
      <p className="text-xs text-gray-500 mt-3">
        If an ACS endpoint is required, use: https://auth.net2phone.com/saml/login/callback
      </p>
    </div>
  );
}
