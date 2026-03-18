export const locales = ["en", "es", "fr-CA", "pt-BR"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Human-readable locale names for the language picker. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "fr-CA": "Français (Canada)",
  "pt-BR": "Português (Brasil)",
};

/** IETF language tag → HTML lang attribute */
export const localeLangTags: Record<Locale, string> = {
  en: "en",
  es: "es",
  "fr-CA": "fr-CA",
  "pt-BR": "pt-BR",
};
