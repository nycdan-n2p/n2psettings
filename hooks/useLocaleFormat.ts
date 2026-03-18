"use client";

import { useFormatter } from "next-intl";
import { useLocaleContext } from "@/contexts/LocaleContext";

/**
 * Returns locale-aware formatting helpers for dates, times, numbers, and durations.
 * All formatting respects the active locale set by the user.
 */
export function useLocaleFormat() {
  const format = useFormatter();
  const { locale } = useLocaleContext();

  /** Format a date string/Date to a localized date (e.g. "Dec 31, 2024" / "31 déc. 2024") */
  const formatDate = (value: string | Date, opts?: { style?: "short" | "medium" | "long" }): string => {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "—";
    const dateStyle = opts?.style ?? "medium";
    return format.dateTime(d, { dateStyle });
  };

  /** Format a date+time string/Date to localized date and time */
  const formatDateTime = (value: string | Date): string => {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "—";
    return format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  };

  /** Format just the time portion */
  const formatTime = (value: string | Date): string => {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "—";
    return format.dateTime(d, { timeStyle: "short" });
  };

  /** Format a number (e.g. 1234.56 → "1,234.56" / "1 234,56") */
  const formatNumber = (value: number): string => {
    return format.number(value);
  };

  /**
   * Smart relative date: "Today, 3:45 PM" / "Yesterday, 9:00 AM" / "Dec 31, 9:00 AM"
   * Returns locale-correct date and time.
   */
  const formatRelativeDate = (value: string | Date): string => {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "—";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString();
    const timeStr = format.dateTime(d, { timeStyle: "short" });
    if (isToday) return `${todayLabel(locale)}, ${timeStr}`;
    if (isYesterday) return `${yesterdayLabel(locale)}, ${timeStr}`;
    return `${format.dateTime(d, { month: "short", day: "numeric" })}, ${timeStr}`;
  };

  return { formatDate, formatDateTime, formatTime, formatNumber, formatRelativeDate };
}

function todayLabel(locale: string): string {
  switch (locale) {
    case "es": return "Hoy";
    case "fr-CA": return "Aujourd\u2019hui";
    case "pt-BR": return "Hoje";
    default: return "Today";
  }
}

function yesterdayLabel(locale: string): string {
  switch (locale) {
    case "es": return "Ayer";
    case "fr-CA": return "Hier";
    case "pt-BR": return "Ontem";
    default: return "Yesterday";
  }
}
