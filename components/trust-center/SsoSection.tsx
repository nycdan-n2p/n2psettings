"use client";

import { useApp } from "@/contexts/AppContext";
import { ExternalLink, Info, Settings } from "lucide-react";

const ACS_ENDPOINT = "https://auth.net2phone.com/saml/login/callback";

/**
 * SSO is configured via auth.net2phone.com SAML settings page.
 * There is no REST API for SSO config — the legacy form lives on auth.net2phone.com.
 * We embed it in an iframe for parity; fallback link if embedding is blocked.
 */
export function SsoSection() {
  const { bootstrap } = useApp();
  const clientId = bootstrap?.account?.clientId ?? 36422;
  const samlUrl = `https://auth.net2phone.com/saml/settings/${clientId}`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
        <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          Note: If an ACS endpoint is required, please use{" "}
          <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono break-all">
            {ACS_ENDPOINT}
          </code>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <a
          href={samlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          <Settings className="w-4 h-4" />
          Open SAML SSO settings
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <iframe
          src={samlUrl}
          title="SAML SSO Configuration"
          className="w-full min-h-[600px] border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
        <p className="p-3 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
          If the form above doesn&apos;t load,{" "}
          <a
            href={samlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1a73e8] hover:underline"
          >
            open SAML SSO settings in a new tab
          </a>
          .
        </p>
      </div>
    </div>
  );
}
