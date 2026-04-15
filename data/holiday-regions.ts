export interface HolidayRegion {
  code: string;   // ISO 3166-1 alpha-2
  label: string;  // display name
  flag: string;   // emoji flag
  group: "North America" | "CALA";
}

export const HOLIDAY_REGIONS: HolidayRegion[] = [
  // North America
  { code: "US", label: "United States",       flag: "🇺🇸", group: "North America" },
  { code: "CA", label: "Canada",              flag: "🇨🇦", group: "North America" },
  { code: "MX", label: "Mexico",              flag: "🇲🇽", group: "North America" },

  // CALA
  { code: "BR", label: "Brazil",              flag: "🇧🇷", group: "CALA" },
  { code: "CO", label: "Colombia",            flag: "🇨🇴", group: "CALA" },
  { code: "AR", label: "Argentina",           flag: "🇦🇷", group: "CALA" },
  { code: "CL", label: "Chile",              flag: "🇨🇱", group: "CALA" },
  { code: "PE", label: "Peru",               flag: "🇵🇪", group: "CALA" },
  { code: "DO", label: "Dominican Republic",  flag: "🇩🇴", group: "CALA" },
  { code: "PA", label: "Panama",             flag: "🇵🇦", group: "CALA" },
  { code: "CR", label: "Costa Rica",         flag: "🇨🇷", group: "CALA" },
  { code: "EC", label: "Ecuador",            flag: "🇪🇨", group: "CALA" },
  { code: "GT", label: "Guatemala",          flag: "🇬🇹", group: "CALA" },
  { code: "HN", label: "Honduras",           flag: "🇭🇳", group: "CALA" },
  { code: "SV", label: "El Salvador",        flag: "🇸🇻", group: "CALA" },
  { code: "NI", label: "Nicaragua",          flag: "🇳🇮", group: "CALA" },
  { code: "BO", label: "Bolivia",            flag: "🇧🇴", group: "CALA" },
  { code: "VE", label: "Venezuela",          flag: "🇻🇪", group: "CALA" },
  { code: "PY", label: "Paraguay",           flag: "🇵🇾", group: "CALA" },
  { code: "UY", label: "Uruguay",            flag: "🇺🇾", group: "CALA" },
];

export const REGION_GROUPS = ["North America", "CALA"] as const;
