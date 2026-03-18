import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Prefix strategy: "as-needed" means the default locale has no prefix (/),
  // while other locales do (/es, /fr-CA, /pt-BR).
  // This keeps the existing /ucass/... URLs working for English users.
  localePrefix: "as-needed",
});
