"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocaleContext } from "@/contexts/LocaleContext";
import type { Locale } from "@/i18n/config";

/**
 * Compact language picker that drops down over the current locale.
 * Place it anywhere in the UI — it reads from / writes to LocaleContext.
 */
export function LocaleSelector({ className = "" }: { className?: string }) {
  const t = useTranslations("locale");
  const { locale, locales, localeNames, setLocale } = useLocaleContext();

  return (
    <div className={`relative group ${className}`}>
      <button
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-black/[0.06] transition-colors"
        title={t("label")}
        aria-label={t("label")}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline text-xs font-medium uppercase">{locale}</span>
      </button>

      <ul
        role="listbox"
        aria-label={t("label")}
        className="
          absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg
          text-gray-900 text-sm py-1
          opacity-0 invisible group-hover:opacity-100 group-hover:visible
          transition-all z-50
        "
      >
        {locales.map((l: Locale) => (
          <li key={l} role="option" aria-selected={l === locale}>
            <button
              onClick={() => setLocale(l)}
              className={`
                w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors
                ${l === locale ? "font-semibold text-[#1a73e8]" : "text-gray-700"}
              `}
            >
              {localeNames[l]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
