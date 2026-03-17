// Fetches public holidays from the free Nager.Date API (no key required)
// https://date.nager.at/

export interface PublicHoliday {
  date: string;          // "2025-07-04"
  localName: string;     // local language name
  name: string;          // English name
  countryCode: string;   // "US"
  fixed: boolean;
  global: boolean;
  counties?: string[] | null;
  launchYear?: number | null;
  types: string[];       // "Public", "Bank", etc.
}

export async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<PublicHoliday[]> {
  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as PublicHoliday[]) : [];
}
