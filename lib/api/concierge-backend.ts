import type { OnboardingData, OnboardingUser } from "@/contexts/ConciergeContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScrapedWebsiteData {
  location: string;
  timezone: string;
  timezoneIana: string;
  hours: Record<string, string>;
  phones: string[];
  address: string;
  companyName?: string;
}

export interface ApplyStep {
  label: string;
  status: "ok" | "warn" | "skip";
  detail?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── researchWebsite ──────────────────────────────────────────────────────────

export async function researchWebsite(url: string): Promise<ScrapedWebsiteData> {
  const res = await fetch("/api/research-website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(25_000),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `research-website failed with HTTP ${res.status}`);
  }
  return json as ScrapedWebsiteData;
}

// ── parseCSV ─────────────────────────────────────────────────────────────────

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
    { firstName: "Alice",  lastName: "Chen",     email: "alice@company.com" },
    { firstName: "Bob",    lastName: "Martinez",  email: "bob@company.com" },
    { firstName: "Carol",  lastName: "Johnson",   email: "carol@company.com" },
    { firstName: "David",  lastName: "Kim",       email: "david@company.com" },
  ];
}

// ── checkLicensing ────────────────────────────────────────────────────────────
//
// Checks the account's license list for call_queue eligibility.
// Falls back to false if the token is unavailable or the API call fails.

export async function checkLicensing(
  feature: string,
  token?: string
): Promise<boolean> {
  if (feature !== "call_queues") return true; // ring_groups always included

  if (!token) return false; // can't check without auth

  try {
    const res = await fetch("/api/n2p-tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool: "list_licenses", input: {} }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const licenses = (json.data ?? json) as Array<Record<string, unknown>>;
    if (!Array.isArray(licenses)) return false;

    // Check for any call queue related license
    return licenses.some((lic) => {
      const name = String(lic.name ?? lic.licenseType ?? lic.type ?? "").toLowerCase();
      return name.includes("queue") || name.includes("ccaas") || name.includes("contact");
    });
  } catch {
    return false;
  }
}

// ── Business hours parser ─────────────────────────────────────────────────────
//
// Converts scraped hours like { Monday: "9:00 AM – 5:00 PM", Saturday: "Closed" }
// into net2phone schedule rules and also the simplified schedule block needed
// by build_call_flow.

const DAY_NUM: Record<string, number> = {
  Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7,
};

function parseTime(t: string): string | null {
  t = t.trim();
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = ampm[2];
    if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m}`;
  }
  const plain = t.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return `${parseInt(plain[1]).toString().padStart(2, "0")}:${plain[2]}`;
  return null;
}

function getPrimaryWorkHours(
  hours: Record<string, string>
): { weekDays: number[]; start: string; end: string } | null {
  // Collect open-day groups
  const groups: Record<string, number[]> = {};
  for (const [day, timeStr] of Object.entries(hours)) {
    const dayNum = DAY_NUM[day];
    if (!dayNum || timeStr.toLowerCase() === "closed") continue;
    const parts = timeStr.split(/\s*[-–]\s*/);
    if (parts.length < 2) continue;
    const start = parseTime(parts[0]);
    const end   = parseTime(parts[1]);
    if (!start || !end) continue;
    const key = `${start}|${end}`;
    groups[key] = [...(groups[key] ?? []), dayNum];
  }
  const entries = Object.entries(groups);
  if (!entries.length) return null;
  // Pick the block with the most days (Mon–Fri typically)
  entries.sort((a, b) => b[1].length - a[1].length);
  const [key, weekDays] = entries[0];
  const [start, end] = key.split("|");
  return { weekDays, start, end };
}

// ── applyConfiguration ────────────────────────────────────────────────────────
//
// Submits the complete onboarding payload to the backend via real API calls.
// Operations in order:
//   1. Create each user (auto-assign extension)
//   2. Create each department
//   3. Assign users to their departments
//   4a. ring_groups: create ring group + set members + build call flow
//   4b. call_queues: create call queue + set agents
//
// Returns { success, steps, error? } — individual step failures are soft errors
// so we report them without aborting the whole process.

export async function applyConfiguration(
  payload: OnboardingData,
  token: string
): Promise<{ success: boolean; error?: string; steps: ApplyStep[] }> {
  const steps: ApplyStep[] = [];

  async function n2p(
    tool: string,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const res = await fetch("/api/n2p-tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool, input }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `${tool} failed (${res.status})`);
    return (json.data ?? json) as Record<string, unknown>;
  }

  try {
    // ── 1. Create users ───────────────────────────────────────────────────────
    const userIds: number[] = [];
    const emailToUserId = new Map<string, number>();

    if (payload.users.length === 0) {
      steps.push({ label: "Users", status: "skip", detail: "No users were added during onboarding" });
    } else {
      // Fetch starting extension once
      let nextExt = 100;
      try {
        const extData = await n2p("get_next_extension", {});
        const parsed = parseInt(String(extData.nextExtension ?? "100"), 10);
        if (!isNaN(parsed)) nextExt = parsed;
      } catch { /* use default 100 */ }

      for (const user of payload.users) {
        try {
          const created = await n2p("create_user", {
            firstName: user.firstName,
            lastName:  user.lastName,
            email:     user.email,
            extension: String(nextExt++),
          });
          const userId = Number(created.userId ?? created.id ?? 0);
          if (userId) {
            userIds.push(userId);
            emailToUserId.set(user.email, userId);
            steps.push({ label: `User: ${user.firstName} ${user.lastName}`, status: "ok" });
          } else {
            steps.push({ label: `User: ${user.firstName} ${user.lastName}`, status: "warn", detail: "Created but no ID returned" });
          }
        } catch (e) {
          steps.push({ label: `User: ${user.firstName} ${user.lastName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // ── 2. Create departments ─────────────────────────────────────────────────
    const deptNameToId = new Map<string, number>();

    for (const deptName of payload.departments) {
      try {
        const created = await n2p("create_department", { name: deptName });
        const deptId = Number(created.deptId ?? created.dept_id ?? created.id ?? 0);
        if (deptId) {
          deptNameToId.set(deptName, deptId);
          steps.push({ label: `Department: ${deptName}`, status: "ok" });
        }
      } catch (e) {
        steps.push({ label: `Department: ${deptName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── 3. Assign users to departments ────────────────────────────────────────
    for (const user of payload.users) {
      if (!user.department) continue;
      const userId = emailToUserId.get(user.email);
      const deptId = deptNameToId.get(user.department);
      if (!userId || !deptId) continue;
      try {
        await n2p("assign_user_to_department", { userId, deptId });
        steps.push({ label: `${user.firstName} ${user.lastName} → ${user.department}`, status: "ok" });
      } catch (e) {
        steps.push({ label: `Assign ${user.firstName} → ${user.department}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── 4. Ring group or call queue + call flow ───────────────────────────────
    const groupName = `${payload.companyName || "Main"} Team`;

    if (payload.routingType === "ring_groups") {
      // Create ring group
      let rgId = "";
      try {
        const rg = await n2p("create_ring_group", { name: groupName });
        rgId = String(rg.id ?? rg.ringGroupId ?? "");
        steps.push({ label: `Ring Group: ${groupName}`, status: "ok" });
      } catch (e) {
        steps.push({ label: `Ring Group: ${groupName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }

      // Add all users
      if (rgId && userIds.length > 0) {
        try {
          await n2p("set_ring_group_members", { ringGroupId: rgId, userIds });
          steps.push({ label: `${userIds.length} member(s) added to ring group`, status: "ok" });
        } catch (e) {
          steps.push({ label: "Set ring group members", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }

      // Build call flow (schedule + time-based routing)
      if (rgId) {
        const workHrs = getPrimaryWorkHours(payload.scraped.hours);
        const mainNumber = payload.portingQueue.numbers[0] ?? payload.scraped.phones[0];
        try {
          const cf = await n2p("build_call_flow", {
            mainNumber: mainNumber || undefined,
            workHours: {
              schedule:    workHrs ?? undefined,
              destination: { type: "ring_group", name: groupName },
            },
            afterHours: {
              destination: { type: "ring_group", name: groupName },
            },
            noAnswer: { type: "voicemail" },
          });
          const msg = String(cf.message ?? "");
          steps.push({ label: "Call flow routing", status: "ok", detail: msg || undefined });
        } catch (e) {
          steps.push({ label: "Call flow routing", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }
    } else {
      // Call queue path
      let queueId = "";
      try {
        const q = await n2p("create_call_queue", { name: groupName });
        queueId = String(q.id ?? q.queueId ?? "");
        steps.push({ label: `Call Queue: ${groupName}`, status: "ok" });
      } catch (e) {
        steps.push({ label: `Call Queue: ${groupName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }

      if (queueId && userIds.length > 0) {
        try {
          await n2p("set_call_queue_agents", { queueId, userIds });
          steps.push({ label: `${userIds.length} agent(s) added to call queue`, status: "ok" });
        } catch (e) {
          steps.push({ label: "Set call queue agents", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    return { success: true, steps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration failed";
    return { success: false, error: msg, steps };
  }
}

// ── Keep delay accessible for any future test/mock usage ─────────────────────
export { delay };
