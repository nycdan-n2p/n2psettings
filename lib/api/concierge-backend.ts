import type { OnboardingData, OnboardingUser } from "@/contexts/ConciergeContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScrapedWebsiteData {
  location: string;      // "New York, NY"
  timezone: string;      // "EST"
  timezoneIana: string;  // "America/New_York"
  hours: Record<string, string>; // { Monday: "9:00 AM – 5:00 PM", ... }
  phones: string[];      // ["+12125551234"]
  address: string;       // "123 Main St, New York, NY 10001"
  companyName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── researchWebsite ──────────────────────────────────────────────────────────
//
// Calls the real /api/research-website route which fetches the site and uses
// Claude to extract location, timezone, hours, phones, and address.
// Throws on failure so the caller (the Concierge AI) can surface the error.

export async function researchWebsite(url: string): Promise<ScrapedWebsiteData> {
  const res = await fetch("/api/research-website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    // Allow up to 25s — site fetch + Claude extraction
    signal: AbortSignal.timeout(25_000),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? `research-website failed with HTTP ${res.status}`);
  }

  return json as ScrapedWebsiteData;
}

// ── parseCSV ─────────────────────────────────────────────────────────────────
//
// Parses a CSV file where the first row is headers.
// Expected columns (case-insensitive): first_name / firstName, last_name / lastName, email
// Falls back to mock data if parsing fails.

export async function parseCSV(file: File): Promise<OnboardingUser[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error("Too few rows");

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

        const col = (key: string) => {
          const aliases: Record<string, string[]> = {
            firstName: ["first_name", "firstname", "first"],
            lastName:  ["last_name",  "lastname",  "last"],
            email:     ["email", "email_address"],
          };
          const opts = aliases[key] ?? [key];
          for (const a of opts) {
            const idx = headers.indexOf(a);
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const fiCol = col("firstName");
        const laCol = col("lastName");
        const emCol = col("email");

        const users: OnboardingUser[] = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          return {
            firstName: fiCol >= 0 ? cells[fiCol] : "",
            lastName:  laCol >= 0 ? cells[laCol] : "",
            email:     emCol >= 0 ? cells[emCol] : "",
          };
        }).filter((u) => u.firstName || u.email);

        resolve(users.length ? users : mockUsers());
      } catch {
        resolve(mockUsers());
      }
    };
    reader.onerror = () => resolve(mockUsers());
    reader.readAsText(file);
  });
}

function mockUsers(): OnboardingUser[] {
  return [
    { firstName: "Alice",   lastName: "Chen",    email: "alice@company.com"   },
    { firstName: "Bob",     lastName: "Martinez", email: "bob@company.com"    },
    { firstName: "Carol",   lastName: "Johnson",  email: "carol@company.com"  },
    { firstName: "David",   lastName: "Kim",      email: "david@company.com"  },
  ];
}

// ── checkLicensing ────────────────────────────────────────────────────────────
//
// Returns true if the account has the required license for a feature.
// In production, wire to the real licensing endpoint.

export async function checkLicensing(feature: string): Promise<boolean> {
  await delay(900);
  // Mock: call_queues requires an add-on; ring_groups is always available
  if (feature === "call_queues") return false;
  return true;
}

// ── applyConfiguration ────────────────────────────────────────────────────────
//
// Submits the full onboarding payload to the backend.
// In production this calls the existing settings APIs sequentially:
//   createSchedule → createDepartments → createUsers → assignNumbers → buildCallFlow → portingRequest
//
// Returns { success, error? }

export async function applyConfiguration(
  payload: OnboardingData
): Promise<{ success: boolean; error?: string }> {
  await delay(2200);

  // Always succeeds in mock mode. Swap with real API calls when ready.
  console.info("[Concierge] applyConfiguration payload:", JSON.stringify(payload, null, 2));

  return { success: true };
}
