"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
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

/**
 * Locale is driven entirely by IntlProvider (which reads the NEXT_LOCALE cookie
 * after mount). We never store locale in local state here — using the prop
 * directly means the context value automatically updates whenever IntlProvider
 * re-renders with the new locale after its useEffect fires.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const setLocale = useCallback((newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
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
