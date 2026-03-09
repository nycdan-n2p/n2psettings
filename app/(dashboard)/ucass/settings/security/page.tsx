"use client";

import { useApp } from "@/contexts/AppContext";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { SettingsRow } from "@/components/settings/SettingsGroup";
import { ExternalLink } from "lucide-react";

export default function SecurityPage() {
  const { bootstrap } = useApp();
  const clientId = bootstrap?.account?.clientId ?? 36422;

  const samlUrl = `https://auth.net2phone.com/saml/settings/${clientId}`;
  const authBase = "https://auth.net2phone.com";

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Security</h1>
      <p className="text-gray-600 mb-6">
        SAML SSO and 2FA configuration.
      </p>
      <CollapsibleSection
        title="Authentication"
        subtitle="SAML and two-factor authentication"
        defaultExpanded
      >
        <SettingsRow
          label="SAML SSO"
          description="Configure single sign-on for your organization"
        >
          <a
            href={samlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Open SAML settings
            <ExternalLink className="w-4 h-4" />
          </a>
        </SettingsRow>
        <SettingsRow
          label="Two-Factor Authentication"
          description="Manage 2FA for your account"
        >
          <a
            href={`${authBase}/api/2fa/details`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Open 2FA settings
            <ExternalLink className="w-4 h-4" />
          </a>
        </SettingsRow>
      </CollapsibleSection>
    </div>
  );
}
