"use client";
import { useTranslations } from "next-intl";

import { ProductHeader } from "@/components/layout/ProductHeader";

export default function UcontactProductPage() {
  const t = useTranslations("productPages");
  return (
    <div>
      <ProductHeader
        productId="ucontact"
        status={t("statusComingSoon")}
      />
      <p className="text-gray-600 mb-6">
        {t("ucontactSubtitle")}
      </p>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-white">
          <h2 className="text-lg font-medium text-gray-900">uContact Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            {t("ucontactDesc")}
          </p>
          <p className="text-sm text-gray-500">
            {t("comingSoon")}
          </p>
        </div>
      </div>
    </div>
  );
}
