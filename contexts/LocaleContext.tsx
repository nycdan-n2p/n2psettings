"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { locales, defaultLocale, localeNames, type Locale } from "@/i18n/config";

interface LocaleContextValue {
  locale: Locale;
  localeNames: typeof localeNames;
  locales: typeof locales;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  localeNames,
  locales,
  setLocale: () => {},
});

export function LocaleProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const pathname = usePathname();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      // Persist to cookie so next-intl middleware picks it up on the next request.
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

      // Navigate to the same page under the new locale prefix.
      // For "en" (default locale), next-intl uses no prefix so we strip it.
      const segments = pathname.split("/").filter(Boolean);
      const currentLocalePrefix = locales.find((l) => segments[0] === l);
      const pathWithoutLocale = currentLocalePrefix
        ? "/" + segments.slice(1).join("/")
        : pathname;

      const newPath =
        newLocale === defaultLocale
          ? pathWithoutLocale || "/"
          : `/${newLocale}${pathWithoutLocale}`;

      router.push(newPath);
      router.refresh();
    },
    [pathname, router]
  );

  return (
    <LocaleContext.Provider value={{ locale, localeNames, locales, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
