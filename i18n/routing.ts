import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // "never" means NO locale prefix is ever added to URLs.
  // Locale is determined exclusively by the NEXT_LOCALE cookie (set by LocaleContext)
  // or the Accept-Language header — never by redirecting to /es/... paths.
  // This prevents 404s that occur when the middleware redirects to a locale-prefixed
  // path that has no corresponding page in the app directory.
  localePrefix: "never",
});
