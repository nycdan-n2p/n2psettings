"use client";

import { useState } from "react";
import { Globe, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge } from "@/contexts/ConciergeContext";
import { validateUrl } from "@/lib/utils/validation";
import { CardShell, ValidationErrors } from "./shared";

export function WelcomeScrapeWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const t = useTranslations("concierge");
  const { config } = useConcierge();
  const [name, setName] = useState(config.name);
  const [url, setUrl]   = useState(config.websiteUrl);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push(t("welcome.nameRequired"));
    if (!url.trim()) errs.push(t("welcome.urlRequired"));
    else if (!validateUrl(url.trim())) errs.push(t("welcome.urlInvalid"));
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    onMessages([`${name.trim()} \u00b7 ${url.trim()}`]);
  };

  return (
    <CardShell>
      <div className="space-y-3">
        <div>
          <label htmlFor="welcome-name" className="block text-xs font-medium text-gray-600 mb-1">{t("welcome.nameLabel")}</label>
          <input
            id="welcome-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("welcome.namePlaceholder")}
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          />
        </div>
        <div>
          <label htmlFor="welcome-url" className="block text-xs font-medium text-gray-600 mb-1">{t("welcome.urlLabel")}</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              id="welcome-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={t("welcome.urlPlaceholder")}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>
        <ValidationErrors errors={errors} />
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          {t("welcome.letsGo")}
        </button>
      </div>
    </CardShell>
  );
}
