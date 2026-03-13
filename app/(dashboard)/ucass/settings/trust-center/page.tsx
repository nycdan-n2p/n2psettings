"use client";

import { Hash, ExternalLink, Hand } from "lucide-react";
import Link from "next/link";
import { TenDlcSection } from "@/components/trust-center/TenDlcSection";
import { SsoSection } from "@/components/trust-center/SsoSection";
import { TwoFactorSection } from "@/components/trust-center/TwoFactorSection";
import { SecuritySection } from "@/components/trust-center/SecuritySection";

function TrustCard({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6"
    >
      <h2 className="text-lg font-medium text-gray-900 mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-gray-600 mb-4">{description}</p>
      )}
      {children}
    </div>
  );
}

export default function TrustCenterPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">
        Register your numbers
      </h1>
      <p className="text-gray-600 mb-6">
        Carriers require that all VoIP numbers are registered before they can
        send text messages to US and Canadian numbers.
      </p>

      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
        <Hand className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          You need to upgrade to a paid plan before you can register your
          numbers.
        </p>
      </div>

      <TrustCard
        title="Local numbers registration"
        description="Register your local numbers to send text messages to US numbers"
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="#messaging-10dlc"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium border border-gray-300"
          >
            Register now
          </a>
          <Link
            href="https://support.net2phone.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            Learn more
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <div className="w-12 h-12 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
            <Hash className="w-6 h-6 text-[#1a73e8]" />
          </div>
        </div>
      </TrustCard>

      <TrustCard
        title="Clear Scam Likely labeling"
        description="If your phone numbers are flagged due to prior misuse, use the Free Caller Registry to update their ownership details"
      >
        <a
          href="https://freecallerregistry.com/fcr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Register now
          <ExternalLink className="w-4 h-4" />
        </a>
      </TrustCard>

      <TrustCard
        id="messaging-10dlc"
        title="MESSAGING REGISTRATION CENTER"
        description="Here's where you can manage your 10DLC Brand, Campaign, and phone number registrations."
      >
        <TenDlcSection />
      </TrustCard>

      <TrustCard
        id="sso"
        title="SINGLE SIGN ON"
        description="Allow team members to sign into net2phone using their corporate credentials. Enable single sign on for your organization by adding your identity provider below."
      >
        <SsoSection />
      </TrustCard>

      <TrustCard
        id="two-factor"
        title="Two-Factor Authentication"
        description="Require 2FA for all users on your account"
      >
        <TwoFactorSection />
      </TrustCard>

      <TrustCard title="Security" description="SAML SSO and 2FA configuration">
        <SecuritySection />
      </TrustCard>
    </div>
  );
}
