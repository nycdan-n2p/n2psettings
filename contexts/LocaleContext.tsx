"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { defaultLocale, localeNames, locales, type Locale } from "@/i18n/config";

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

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Persist to cookie so next-intl picks it up on the next server render.
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Full reload so the root layout (app/layout.tsx) re-fetches with the new cookie.
    // router.refresh() does not reliably cause shared layout segments to re-render.
    window.location.reload();
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, localeNames, locales, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
