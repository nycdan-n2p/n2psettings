"use client";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("trustCenterPage");
  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">{t("title")}</h1>
      <p className="text-gray-600 mb-6 max-w-2xl">{t("subtitle")}</p>

      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
        <Hand className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">{t("upgradeNote")}</p>
      </div>

      <TrustCard title={t("localNumbersTitle")} description={t("localNumbersDesc")}>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#messaging-10dlc" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium border border-gray-300">
            {t("registerNow")}
          </a>
          <Link href="https://support.net2phone.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700">
            {t("learnMore")}
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <div className="w-12 h-12 rounded-lg bg-[#e8f0fe] flex items-center justify-center">
            <Hash className="w-6 h-6 text-[#1a73e8]" />
          </div>
        </div>
      </TrustCard>

      <TrustCard title={t("scamTitle")} description={t("scamDesc")}>
        <a href="https://freecallerregistry.com/fcr/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">
          {t("registerNow")}
          <ExternalLink className="w-4 h-4" />
        </a>
      </TrustCard>

      <TrustCard id="messaging-10dlc" title={t("messagingTitle")} description={t("messagingDesc")}>
        <TenDlcSection />
      </TrustCard>

      <TrustCard id="sso" title={t("ssoTitle")} description={t("ssoDesc")}>
        <SsoSection />
      </TrustCard>

      <TrustCard id="two-factor" title={t("twoFaTitle")} description={t("twoFaDesc")}>
        <TwoFactorSection />
      </TrustCard>

      <TrustCard title={t("securityTitle")} description={t("securityDesc")}>
        <SecuritySection />
      </TrustCard>
    </div>
  );
}
