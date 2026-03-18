import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * next-intl server configuration — "without i18n routing" mode.
 *
 * Locale is resolved from the NEXT_LOCALE cookie (set by LocaleSelector).
 * No middleware or URL-based locale routing is used, which prevents the
 * next-intl v4 middleware from returning 404 on the root path when there
 * is no [locale] folder in the app directory.
 *
 * Resolution order:
 *   1. NEXT_LOCALE cookie
 *   2. Default locale ("en")
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
