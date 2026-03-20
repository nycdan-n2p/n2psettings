import type { OnboardingData, OnboardingUser } from "@/contexts/ConciergeContext";
import { withRetry, isRetryableNetworkError } from "@/lib/utils/retry";

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

// ── researchWebsite ──────────────────────────────────────────────────────────

export async function researchWebsite(url: string): Promise<ScrapedWebsiteData> {
  const res = await withRetry(
    () =>
      fetch("/api/research-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(25_000),
      }),
    { maxRetries: 2, shouldRetry: isRetryableNetworkError }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `research-website failed with HTTP ${res.status}`);
  }
  return json as ScrapedWebsiteData;
}

// ── parseCSV ─────────────────────────────────────────────────────────────────

export async function parseCSV(file: File): Promise<OnboardingUser[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          reject(new Error("CSV must have a header row and at least one data row."));
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

        const col = (key: string) => {
          const aliases: Record<string, string[]> = {
            firstName: ["first_name", "firstname", "first", "first name", "given_name", "givenname"],
            lastName:  ["last_name",  "lastname",  "last", "last name", "surname", "family_name", "familyname"],
            email:     ["email", "email_address", "e-mail", "e_mail", "email address"],
            extension: ["extension", "ext", "extension_number", "extensionnumber", "phone_ext"],
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
        const exCol = col("extension");

        const users: OnboardingUser[] = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const extVal = exCol >= 0 ? cells[exCol] : "";
          return {
            firstName: fiCol >= 0 ? cells[fiCol] : "",
            lastName:  laCol >= 0 ? cells[laCol] : "",
            email:     emCol >= 0 ? cells[emCol] : "",
            ...(extVal ? { extension: extVal } : {}),
          };
        }).filter((u) => u.firstName || u.email);

        if (users.length === 0) {
          reject(new Error("No valid user rows found. Ensure your CSV has first_name, last_name, and email columns."));
          return;
        }

        resolve(users);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Failed to parse CSV file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read CSV file"));
    reader.readAsText(file);
  });
}

// ── checkLicensing ────────────────────────────────────────────────────────────

export async function checkLicensing(
  feature: string,
  token?: string
): Promise<boolean> {
  if (feature !== "call_queues") return true;
  if (!token) return false;

  try {
    const res = await withRetry(
      () =>
        fetch("/api/n2p-tools", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tool: "list_licenses", input: {} }),
        }),
      { maxRetries: 2, shouldRetry: isRetryableNetworkError }
    );
    if (!res.ok) return false;
    const json = await res.json();
    const licenses = (json.data ?? json) as Array<Record<string, unknown>>;
    if (!Array.isArray(licenses)) return false;

    return licenses.some((lic) => {
      const name = String(lic.name ?? lic.licenseType ?? lic.type ?? "").toLowerCase();
      return name.includes("queue") || name.includes("ccaas") || name.includes("contact");
    });
  } catch {
    return false;
  }
}

// ── Business hours parser ─────────────────────────────────────────────────────

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
  entries.sort((a, b) => b[1].length - a[1].length);
  const [key, weekDays] = entries[0];
  const [start, end] = key.split("|");
  return { weekDays, start, end };
}

// ── applyConfiguration ────────────────────────────────────────────────────────

export async function applyConfiguration(
  payload: OnboardingData,
  token: string,
  onStep?: (step: ApplyStep) => void
): Promise<{ success: boolean; error?: string; steps: ApplyStep[]; okCount: number; warnCount: number }> {
  const steps: ApplyStep[] = [];
  let okCount = 0;
  let warnCount = 0;

  function push(step: ApplyStep) {
    steps.push(step);
    if (step.status === "ok")   okCount++;
    if (step.status === "warn") warnCount++;
    onStep?.(step);
    if (step.status === "ok") {
      console.info(`[Concierge apply] \u2713 ${step.label}`);
    } else if (step.status === "warn") {
      console.error(`[Concierge apply] \u2717 ${step.label}: ${step.detail ?? "(no detail)"}`);
    }
  }

  async function n2p(
    tool: string,
    input: Record<string, unknown>,
    timeoutMs = 20_000
  ): Promise<Record<string, unknown>> {
    console.info(`[Concierge apply] \u2192 ${tool}`, JSON.stringify(input).slice(0, 200));
    const res = await fetch("/api/n2p-tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool, input }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await res.json();
    if (!res.ok) {
      const errMsg = json.error ?? `${tool} failed (HTTP ${res.status})`;
      console.error(`[Concierge apply] \u2717 ${tool} HTTP ${res.status}:`, JSON.stringify(json).slice(0, 300));
      throw new Error(errMsg);
    }
    console.info(`[Concierge apply] \u2190 ${tool} ok:`, JSON.stringify(json.data ?? json).slice(0, 200));
    return (json.data ?? json) as Record<string, unknown>;
  }

  try {
    console.info("[Concierge apply] Starting \u2014 preflight account check");
    await n2p("get_account_summary", {});
    push({ label: "Account connection verified", status: "ok" });

    // ── 1. Create users ─────────────────────────────────────────────────────
    const userIds: number[] = [];
    // Index-based map so CDR users without emails can still be mapped to dept
    const userIndexToId = new Map<number, number>();
    const emailToUserId = new Map<string, number>();

    if (payload.users.length === 0) {
      push({ label: "Users", status: "skip", detail: "No users were added during onboarding" });
    } else {
      let nextExt = 200;
      try {
        const extData = await n2p("get_next_extension", {});
        const parsed = parseInt(String(extData.nextExtension ?? "200"), 10);
        if (!isNaN(parsed) && parsed > 0) nextExt = parsed;
      } catch (e) {
        console.warn("[Concierge apply] get_next_extension failed, using 200:", e);
      }

      let allUsersFailed = true;
      for (let i = 0; i < payload.users.length; i++) {
        const user = payload.users[i];
        // Use CDR-extracted extension if available, otherwise auto-assign
        const ext = user.extension && /^\d+$/.test(user.extension)
          ? user.extension
          : String(nextExt++);
        try {
          const created = await n2p("create_user", {
            firstName: user.firstName,
            lastName:  user.lastName,
            email:     user.email,
            extension: ext,
          });
          const userId = Number(created.userId ?? created.id ?? 0);
          if (userId) {
            userIds.push(userId);
            userIndexToId.set(i, userId);
            if (user.email) emailToUserId.set(user.email, userId);
            push({ label: `Created user: ${user.firstName} ${user.lastName} (ext ${ext})`, status: "ok" });
            allUsersFailed = false;
          } else {
            push({ label: `User: ${user.firstName} ${user.lastName}`, status: "warn", detail: "API returned no user ID" });
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          // 400 "already exists" is not fatal — user may be pre-existing
          const isConflict = errMsg.includes("400") || errMsg.toLowerCase().includes("already");
          push({ label: `User: ${user.firstName} ${user.lastName}`, status: "warn", detail: isConflict ? "Email already registered — skipped" : errMsg });
          if (!isConflict) {
            // Still mark not-all-failed only if at least one succeeded
          } else {
            allUsersFailed = false; // Conflict = user exists = not a build failure
          }
        }
      }

      if (allUsersFailed && payload.users.length > 0) {
        const lastErr = steps.filter((s) => s.status === "warn").pop()?.detail ?? "Unknown error";
        return { success: false, error: `Could not create any users. Last error: ${lastErr}`, steps, okCount, warnCount };
      }
    }

    // ── 2. Create departments ───────────────────────────────────────────────
    const deptNameToId = new Map<string, number>();

    for (const deptName of payload.departments) {
      try {
        const created = await n2p("create_department", { name: deptName });
        const deptId = Number(created.deptId ?? created.dept_id ?? created.id ?? 0);
        if (deptId) {
          deptNameToId.set(deptName, deptId);
          push({ label: `Created department: ${deptName}`, status: "ok" });
        } else {
          push({ label: `Department: ${deptName}`, status: "warn", detail: "No dept ID returned" });
        }
      } catch (e) {
        push({ label: `Department: ${deptName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── 3. Assign users to departments ──────────────────────────────────────
    for (let i = 0; i < payload.users.length; i++) {
      const user = payload.users[i];
      if (!user.department) continue;
      // Prefer index-based lookup (works for CDR users without emails)
      const userId = userIndexToId.get(i) ?? (user.email ? emailToUserId.get(user.email) : undefined);
      const deptId = deptNameToId.get(user.department);
      if (!userId || !deptId) {
        push({ label: `Assign ${user.firstName} \u2192 ${user.department}`, status: "warn", detail: "Missing userId or deptId" });
        continue;
      }
      try {
        await n2p("assign_user_to_department", { userId, deptId });
        push({ label: `${user.firstName} ${user.lastName} \u2192 ${user.department}`, status: "ok" });
      } catch (e) {
        push({ label: `Assign ${user.firstName} \u2192 ${user.department}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── 4. Welcome menu (virtual assistant) ────────────────────────────────
    let welcomeMenuId = "";

    if (payload.welcomeMenu?.enabled) {
      try {
        const menuName = `${(payload.companyName || "Main").trim()} Main Menu`;
        const va = await n2p("create_virtual_assistant", { name: menuName });
        welcomeMenuId = String(va.id ?? va.virtualAssistantId ?? "");
        push({ label: `Created welcome menu: ${menuName}`, status: "ok", detail: `ID: ${welcomeMenuId}` });
      } catch (e) {
        push({ label: "Welcome menu", status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }

      // Apply business features (extension dialing, wait message, barging)
      if (welcomeMenuId) {
        try {
          await n2p("update_virtual_assistant", {
            virtualAssistantId: welcomeMenuId,
            settings: {
              allowExtensionDialing: payload.welcomeMenu.allowExtensionDialing ?? true,
              playWaitMessage: payload.welcomeMenu.playWaitMessage ?? true,
              allowBargingThrough: payload.welcomeMenu.allowBargingThrough ?? true,
            },
          });
          push({ label: "Applied menu settings (ext-dialing, wait msg, barging)", status: "ok" });
        } catch (e) {
          push({ label: "Menu settings", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }

      // Generate TTS greeting if selected
      const usesTts = !payload.welcomeMenu.greetingType || payload.welcomeMenu.greetingType === "tts";
      if (welcomeMenuId && usesTts && payload.welcomeMenu.greetingText) {
        try {
          await n2p("generate_tts_greeting", {
            virtualAssistantId: welcomeMenuId,
            text: payload.welcomeMenu.greetingText,
          });
          push({ label: "Generated TTS greeting", status: "ok" });
        } catch (e) {
          push({ label: "TTS greeting", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      } else if (welcomeMenuId && payload.welcomeMenu.greetingType === "upload") {
        push({ label: "Custom greeting upload", status: "skip", detail: "User will upload after build completes" });
      }

      if (welcomeMenuId && payload.welcomeMenu.menuOptions.length > 0) {
        const options = payload.welcomeMenu.menuOptions
          .filter((o) => o.destinationName.trim())
          .map((o) => ({
            key: o.key,
            destinationType: o.destinationType,
            destinationName: o.destinationName,
          }));
        if (options.length > 0) {
          try {
            await n2p("set_menu_options", {
              virtualAssistantId: welcomeMenuId,
              options,
            });
            push({ label: `Set ${options.length} DTMF menu option(s)`, status: "ok" });
          } catch (e) {
            push({ label: "Menu options", status: "warn", detail: e instanceof Error ? e.message : String(e) });
          }
        }
      }
    } else {
      push({ label: "Welcome menu", status: "skip", detail: "User chose not to set up a welcome menu" });
    }

    // ── 5. Ring group or call queue ──────────────────────────────────────────
    const groupName = payload.routingConfig?.groupName || `${(payload.companyName || "Main").trim()} Team`;
    let routingDestId = "";
    const routingDestType = payload.routingType;

    if (payload.routingType === "ring_groups") {
      try {
        const rg = await n2p("create_ring_group", { name: groupName });
        routingDestId = String(rg.id ?? rg.ringGroupId ?? "");
        push({ label: `Created ring group: ${groupName}`, status: "ok", detail: `ID: ${routingDestId}` });
      } catch (e) {
        push({ label: `Ring Group: ${groupName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }

      if (routingDestId && userIds.length > 0) {
        try {
          await n2p("set_ring_group_members", { ringGroupId: routingDestId, userIds });
          push({ label: `Added ${userIds.length} member(s) to ring group`, status: "ok" });
        } catch (e) {
          push({ label: "Set ring group members", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }

      if (routingDestId && payload.routingConfig?.tiers && payload.routingConfig.tiers.length > 1) {
        try {
          const tierConfig = payload.routingConfig.tiers.map((t, i) => ({
            tier: i + 1,
            rings: t.rings,
            userIds: t.userEmails
              .map((email) => emailToUserId.get(email))
              .filter((id): id is number => !!id),
          }));
          await n2p("set_ring_group_tiers", { ringGroupId: routingDestId, tiers: tierConfig });
          push({ label: `Configured ${tierConfig.length} ring group tier(s)`, status: "ok" });
        } catch (e) {
          push({ label: "Ring group tiers", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }
    } else {
      try {
        const q = await n2p("create_call_queue", { name: groupName });
        routingDestId = String(q.id ?? q.queueId ?? "");
        push({ label: `Created call queue: ${groupName}`, status: "ok", detail: `ID: ${routingDestId}` });
      } catch (e) {
        push({ label: `Call Queue: ${groupName}`, status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }

      if (routingDestId && userIds.length > 0) {
        try {
          await n2p("set_call_queue_agents", { queueId: routingDestId, userIds });
          push({ label: `Added ${userIds.length} agent(s) to call queue`, status: "ok" });
        } catch (e) {
          push({ label: "Set call queue agents", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }

      if (routingDestId && payload.routingConfig) {
        try {
          await n2p("update_call_queue", {
            queueId: routingDestId,
            ring_strategy_type: payload.routingConfig.ringStrategy,
            max_wait_time_seconds: payload.routingConfig.maxWaitTime,
            max_capacity: payload.routingConfig.maxCapacity,
          });
          push({ label: `Configured queue: ${payload.routingConfig.ringStrategy}, max wait ${payload.routingConfig.maxWaitTime}s, capacity ${payload.routingConfig.maxCapacity}`, status: "ok" });
        } catch (e) {
          push({ label: "Queue settings", status: "warn", detail: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // ── 6. Build call flow (wiring everything together) ──────────────────────
    if (routingDestId) {
      const schedType = payload.routingConfig?.scheduleType || "24_7";
      let workHrs: { weekDays: number[]; start: string; end: string } | null = null;
      if (schedType === "business_hours") {
        workHrs = getPrimaryWorkHours(payload.scraped.hours);
      } else if (schedType === "custom" && payload.routingConfig?.customSchedule) {
        const cs = payload.routingConfig.customSchedule;
        workHrs = { weekDays: cs.weekDays, start: cs.start, end: cs.end };
      }
      const schedLabel = schedType === "24_7" ? "24/7" : schedType === "business_hours" ? "Business hours" : "Custom schedule";
      push({ label: `Schedule type: ${schedLabel}`, status: "ok", detail: workHrs ? `${workHrs.start}-${workHrs.end}` : "Always active" });

      const mainNumber = payload.portingQueue.numbers[0] ?? payload.scraped.phones[0];

      const afterHoursConfig = payload.afterHours?.action === "forward"
        ? { destination: { type: "external", number: payload.afterHours.forwardNumber } }
        : payload.afterHours?.action === "greeting"
          ? { destination: { type: "greeting", greetingText: payload.afterHours.greetingText } }
          : { destination: { type: "voicemail" } };

      const workHoursDestination = welcomeMenuId
        ? { type: "virtual_assistant", id: welcomeMenuId }
        : routingDestId
          ? { type: routingDestType === "ring_groups" ? "ring_group" : "call_queue", id: routingDestId, name: groupName }
          : { type: routingDestType === "ring_groups" ? "ring_group" : "call_queue", name: groupName };

      try {
        const cf = await n2p("build_call_flow", {
          mainNumber: mainNumber || undefined,
          workHours: {
            schedule: workHrs ?? undefined,
            destination: workHoursDestination,
          },
          afterHours: afterHoursConfig,
          noAnswer: { type: "voicemail" },
        });
        const msg = String((cf as { message?: string }).message ?? "");
        push({ label: "Built call flow routing", status: "ok", detail: msg || undefined });
      } catch (e) {
        push({ label: "Call flow routing", status: "warn", detail: e instanceof Error ? e.message : String(e) });
      }
    }

  console.info(`[Concierge apply] Done \u2014 ${okCount} ok, ${warnCount} warnings`);
  return { success: true, steps, okCount, warnCount };

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration failed";
    console.error("[Concierge apply] Fatal error:", msg);
    return { success: false, error: msg, steps, okCount, warnCount };
  }
}
