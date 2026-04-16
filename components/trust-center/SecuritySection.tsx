"use client";

import { useApp } from "@/contexts/AppContext";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { SettingsRow } from "@/components/settings/SettingsGroup";
import { getButtonClasses } from "@/components/ui/Button";
import { ExternalLink } from "lucide-react";

export function SecuritySection() {
  const { bootstrap } = useApp();
  const clientId = bootstrap?.account?.clientId ?? 36422;
  const samlUrl = `https://auth.net2phone.com/saml/settings/${clientId}`;

  return (
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
          className={getButtonClasses({ variant: "primary" })}
        >
          Open SAML settings
          <ExternalLink className="w-4 h-4" />
        </a>
      </SettingsRow>
      <SettingsRow
        label="Two-Factor Authentication"
        description="Require 2FA for all users and manage your own 2FA method"
      >
        <a
          href="#two-factor"
          className={getButtonClasses({ variant: "primary" })}
        >
          Open 2FA settings
        </a>
      </SettingsRow>
    </CollapsibleSection>
  );
}
