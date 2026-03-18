"use client";

/**
 * Client-side i18n provider — replaces the server-side createNextIntlPlugin setup.
 *
 * All four message bundles are imported statically so there is no flash of
 * untranslated content on first render. Locale is resolved from the NEXT_LOCALE
 * cookie (set by LocaleSelector) and falls back to "en".
 *
 * This approach avoids using next-intl's server plugin (createNextIntlPlugin /
 * getLocale / getMessages), which was causing every page to 404 on Vercel
 * because it calls cookies() from next/headers inside app/layout.tsx — a path
 * that Next.js static analysis cannot detect as "dynamic", so it tries to
 * pre-render the layout with no request context and the render fails.
 */

import { NextIntlClientProvider } from "next-intl";
import { useState, useEffect, type ReactNode } from "react";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { locales, localeLangTags, type Locale } from "@/i18n/config";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import frCA from "@/messages/fr-CA.json";
import ptBR from "@/messages/pt-BR.json";

const MESSAGES = { en, es, "fr-CA": frCA, "pt-BR": ptBR } as const;
const DEFAULT_LOCALE: Locale = "en";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const value = match?.[1];
  return locales.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function IntlProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const l = readCookieLocale();
    setLocale(l);
    // Keep html[lang] in sync for accessibility / SEO
    document.documentElement.lang = localeLangTags[l] ?? "en";
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <LocaleProvider locale={locale}>
        {children}
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}
