"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      // Persist to cookie so next-intl picks it up on the next server render.
      // With localePrefix: "never", URLs never change — only the cookie changes.
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      // Refresh the current page so server components re-render in the new locale.
      router.refresh();
    },
    [router]
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
