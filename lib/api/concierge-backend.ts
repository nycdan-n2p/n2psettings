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

// ── Mock delay helper ─────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── researchWebsite ──────────────────────────────────────────────────────────
//
// Attempts a real fetch to /api/research-website (stub). Falls back to a
// realistic mock so the UI is always exercisable during development.

export async function researchWebsite(url: string): Promise<ScrapedWebsiteData> {
  try {
    const res = await fetch("/api/research-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      return (await res.json()) as ScrapedWebsiteData;
    }
  } catch {
    // fall through to mock
  }

  // Deterministic mock — derive plausible data from the URL so each call
  // feels contextual rather than identical.
  await delay(1800);

  const domain = (() => {
    try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", ""); }
    catch { return "company.com"; }
  })();

  const [namePart] = domain.split(".");
  const companyName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  return {
    location:    "New York, NY",
    timezone:    "EST",
    timezoneIana:"America/New_York",
    hours: {
      Monday:    "9:00 AM – 5:00 PM",
      Tuesday:   "9:00 AM – 5:00 PM",
      Wednesday: "9:00 AM – 5:00 PM",
      Thursday:  "9:00 AM – 5:00 PM",
      Friday:    "9:00 AM – 5:00 PM",
      Saturday:  "Closed",
      Sunday:    "Closed",
    },
    phones:      ["+12125550100", "+12125550101"],
    address:     "350 Fifth Ave, New York, NY 10118",
    companyName,
  };
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
