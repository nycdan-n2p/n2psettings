import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "advance_stage",
    description:
      "Move the onboarding flow to the next stage. Call this when you have collected everything needed for the current stage and are ready to proceed. Include a brief reason so the UI can acknowledge it.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "One-sentence explanation of why we are advancing (shown to user as confirmation).",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "update_config",
    description:
      "Persist data collected in conversation to the onboarding config object. Call this whenever the user provides a name, website, confirms timezone, provides users, departments, etc. Patch only the fields that changed.",
    input_schema: {
      type: "object",
      properties: {
        patch: {
          type: "object",
          description:
            "Partial OnboardingData object. Top-level keys: name, companyName, websiteUrl, scraped, holidays, portingQueue, users, departments, routingType, licensingVerified, hasHardphones, phoneType (softphone|hardphone|both), welcomeMenu ({ enabled, greetingText, menuOptions: [{ key, destinationType, destinationName }] }), routingConfig ({ groupName, tiers: [{ userEmails, rings }], ringStrategy: ring_all|round_robin|longest_idle|linear|fewest_calls, maxWaitTime, maxCapacity }), afterHours ({ action: voicemail|greeting|forward, forwardNumber?, greetingText? }).",
        },
      },
      required: ["patch"],
    },
  },
  {
    name: "research_website",
    description:
      "Analyze a company website URL and extract: city/location, timezone, business hours, and phone numbers. Call this as soon as you have the website URL.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL of the company website." },
      },
      required: ["url"],
    },
  },
  {
    name: "check_licensing",
    description:
      "Verify whether the account has the license required for a given feature. Use when the user selects 'Call Queues' to confirm eligibility before advancing.",
    input_schema: {
      type: "object",
      properties: {
        feature: {
          type: "string",
          enum: ["call_queues", "ring_groups"],
          description: "Feature to check.",
        },
      },
      required: ["feature"],
    },
  },
  {
    name: "apply_configuration",
    description:
      "Submit the complete onboarding payload to apply all configuration: create users, departments, schedules, ring groups/call queues, and porting request. Call ONLY after the user explicitly confirms the final blueprint.",
    input_schema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to proceed.",
        },
      },
      required: ["confirm"],
    },
  },
  {
    name: "get_account_summary",
    description: "Get the current account overview: total DIDs, available numbers, and max user seats.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_next_extension",
    description: "Get the next available extension number for a new user.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_schedule",
    description: "Create a business-hours schedule from the scraped or confirmed hours.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        timezone: { type: "string" },
        rules: { type: "array", items: { type: "object" } },
      },
      required: ["name"],
    },
  },
  {
    name: "build_call_flow",
    description: "Build the full call routing flow (schedule + ring group or call queue).",
    input_schema: {
      type: "object",
      properties: {
        mainNumber: { type: "string" },
        workHours: { type: "object" },
        afterHours: { type: "object" },
        noAnswer: { type: "object" },
      },
      required: [],
    },
  },
  {
    name: "search_support",
    description: "Search net2phone support articles for product questions.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];

// ── Dynamic system prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(
  stage: string,
  config: Record<string, unknown>
): string {
  const stageGuide: Record<string, string> = {
    welcome_scrape: `You are at the WELCOME stage. Your goal: learn the admin's name and company website URL.
- Greet warmly and introduce yourself briefly.
- Ask for their name AND company website in the same message.
- The user may type "Name · URL" or just a URL — extract the URL from whatever they send.
- As SOON as you have the URL, call research_website(url) immediately. Do NOT ask about timezone, location, or hours — scrape them.
- If config already has scraped data (scraped.timezone or scraped.phones populated), skip scraping — just call advance_stage.
- After research_website returns, call update_config({ name, websiteUrl, companyName, scraped: {location,timezone,hours,phones,address} }), then call advance_stage.`,

    verification_holidays: `You are at the VERIFY & HOLIDAYS stage. You have already scraped the website.
- IMPORTANT: If config.name is already set, do NOT ask for the name again. You already have it.
- Proactively present what you found (location, timezone, hours, phones) in a markdown table.
- Frame it as "Here's what I found for [company] — does everything look right?" rather than asking open questions.
- Allow the user to correct any field inline. Call update_config with any corrections.
- Then ask: "Should I load standard US public holidays into your schedule?"
- WAIT for explicit confirmation or decline (yes/no/sure/skip). Do NOT advance until the user replies.
- Once they reply: call update_config({ holidays: <loaded holidays or []> }), then call advance_stage.
- CRITICAL: Do NOT call advance_stage until you have received a clear yes or no about holidays.`,

    porting: `You are at the PORTING stage.
- Briefly introduce: "The porting widget below will guide you through the 3-step process — or you can skip it to handle later."
- The widget handles everything: number selection, provider details, billing address, and API submission.
- If the user message starts with "[porting-done]": they completed the form and the widget ALREADY saved all portingQueue data to config. Do NOT call update_config — just acknowledge the summary and call advance_stage.
- If the user says skip or "skip porting": call update_config({ portingQueue: { ...config.portingQueue, skipped: true } }), then call advance_stage.
- Do NOT ask for provider details in chat — the widget collects all of that.`,

    user_ingestion: `You are at the USER INGESTION stage.
- Introduce the step: users can type names/emails in chat OR use the form widget below.
- If the user types a name/email pair, call update_config({ users: [...existing, newUser] }) immediately.
- IMPORTANT: If you receive a message starting with "[form]", the widget has ALREADY saved the complete data to config (including firstName, lastName, email for every user). Do NOT call update_config — the data is already persisted. Just acknowledge and call advance_stage immediately. Do NOT ask for details again.
- When the user says they're done (or after processing a [form] message), call advance_stage.`,

    architecture_hardware: `You are at the ARCHITECTURE stage. Users collected: ${JSON.stringify((config as { users?: unknown[] })?.users ?? [])}.
IMPORTANT: Ask ONE question at a time. Do NOT present a form or ask multiple things at once.

Step A — Departments (ask this FIRST, wait for answer):
  "What departments does your team have? For example: Sales, Support, Finance."
  → When they answer, call update_config({ departments: [...] }) immediately.

Step B — User assignments (ONLY after departments are answered, ONLY if users.length > 0):
  Show a table of users and ask: "Which department should each person be in?"
  → When they answer, call update_config({ users: [...with department fields] }).

Step C — Phone type (ask last, wait for answer):
  "How will your team take calls? Options:
    a) Softphone only (net2phone app on computer/mobile — no hardware needed)
    b) Physical desk phones (hardphones — you'll need MAC addresses)
    c) Both (some users on desk phones, some on app)"
  → "Or: not decided yet — we can set up softphones now and add desk phones later."
  → If softphone/not decided: call update_config({ hasHardphones: false, phoneType: "softphone" }).
  → If hardphone: ask for model and MAC address for each user, then call update_config({ hasHardphones: true, phoneType: "hardphone", users: [...with macAddress/hardphoneModel] }).
  → If both: ask which users want desk phones and their MAC addresses, call update_config({ hasHardphones: true, phoneType: "both", users: [...] }).

After ALL THREE steps are answered, call advance_stage.
Do NOT call advance_stage until you have confirmed departments, user assignments, AND phone type.`,

    licensing: `You are at the CALL ROUTING stage. Walk through 3 sequential sub-steps. Ask ONE question at a time, wait for the answer, save with update_config, then move to the next sub-step.

**Sub-step 1 — Welcome Menu (auto-attendant):**
- Ask: "When someone calls your main number, should they hear a menu? For example: 'Thank you for calling ${(config as { companyName?: string }).companyName || "your company"}. Press 1 for Sales, Press 2 for Support.' Most businesses use one."
- If YES: ask what the greeting should say (suggest a default using the company name and their departments). Then ask what each key press should route to — for each DTMF key, collect: the key (1-9), the destination type (department, ring_group, voicemail, directory), and the destination name.
  Save: update_config({ welcomeMenu: { enabled: true, greetingText: "...", menuOptions: [{ key: "1", destinationType: "department", destinationName: "Sales" }, ...] } })
- If NO: save update_config({ welcomeMenu: { enabled: false, greetingText: "", menuOptions: [] } }) and move to sub-step 2.

**Sub-step 2 — Ring Group vs Call Queue + config:**
- Explain: "Ring Groups ring all members at once (included with all plans). Call Queues place callers in a waiting line with strategies like Round Robin or Longest Idle (requires a Call Queue license)."
- Ask which they prefer.
- If Call Queues: call check_licensing("call_queues"). If not eligible, explain and suggest Ring Groups.
- Save routingType: update_config({ routingType: "ring_groups" or "call_queues", licensingVerified: true/false }).
- Then ask for the group/queue name (suggest "${(config as { companyName?: string }).companyName || "Main"} Team" as default).

  **If Ring Groups:** ask about ring strategy — "Should all members ring simultaneously (Ring All), or should calls escalate through tiers (e.g. Tier 1 rings 3 times, then Tier 2)?"
    - If tiered: ask which users/departments are in each tier and how many rings before escalation.
    - Save: update_config({ routingConfig: { groupName, tiers: [{ userEmails: [...], rings: 3 }, ...], ringStrategy: "ring_all", maxWaitTime: 0, maxCapacity: 0 } })

  **If Call Queues:** ask about ring strategy (Ring All / Round Robin / Longest Idle / Linear / Fewest Calls), max wait time in seconds (suggest 300 = 5 min), and max queue capacity (suggest 10).
    - Save: update_config({ routingConfig: { groupName, tiers: [], ringStrategy: "round_robin", maxWaitTime: 300, maxCapacity: 10 } })

**Sub-step 3 — After-hours behavior:**
- Ask: "What should happen when someone calls outside business hours? Options: a) Go to voicemail (most common), b) Play a custom greeting, c) Forward to a mobile number."
- If voicemail: save update_config({ afterHours: { action: "voicemail" } })
- If greeting: ask for the greeting text, then save update_config({ afterHours: { action: "greeting", greetingText: "..." } })
- If forward: ask for the number, then save update_config({ afterHours: { action: "forward", forwardNumber: "+1..." } })

After ALL 3 sub-steps are answered and saved, call advance_stage. Do NOT call advance_stage until all 3 are complete.`,

    final_blueprint: `You are at the FINAL BLUEPRINT stage.
BEFORE presenting the blueprint, check the config for completeness:
- If config.users.length === 0: warn the user and ask if they want to go back to add users first.
- If config.scraped.timezone is empty: note it will default to UTC.
- If config.departments.length === 0: note that no departments will be created.
- If config.routingType is missing: ask which routing type to use before proceeding.

If everything looks reasonable:
- Present a concise markdown summary table of what will be created.
- Ask: "Ready for me to build this out?"
- When they confirm, call apply_configuration({ confirm: true }).
- After apply_configuration returns:
  - The UI already showed a live build log — do NOT repeat all the individual steps.
  - If result.success is true: congratulate them briefly. Mention okCount items created and warnCount warnings if any.
  - If result.success is false: explain the error (result.error) clearly and suggest they check their account connection.
  - Then call advance_stage.
- If anything looks wrong BEFORE confirming, help them navigate back to fix it.`,

    done: `Onboarding is complete. Congratulate the user warmly.
- Give a short summary of what was built.
- Transition message: "I'm now switching to Sidekick mode where you can ask me anything about your account."`,
  };

  const currentGuide = stageGuide[stage] ?? "Continue guiding the user through the onboarding flow.";

  return `You are the **net2phone Setup Concierge** — an AI assistant that guides account administrators through a complete CCaaS configuration. You are conversational, concise, and proactive.

## Your mission
Walk the admin through 7 stages of onboarding in order:
1. **welcome_scrape** — Collect name + website, scrape it
2. **verification_holidays** — Verify scraped data, offer holidays
3. **porting** — Choose which numbers to port
4. **user_ingestion** — Add team members
5. **architecture_hardware** — Departments, user mapping, desk phones
6. **licensing** (Call Routing) — Welcome menu setup, Ring Groups vs Call Queues with full config, after-hours behavior
7. **final_blueprint** — Review full blueprint and build

## Current stage: ${stage}
${currentGuide}

## Data collected so far
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Communication rules
- Be brief. 2–4 sentences max per response unless showing a data table.
- Use markdown tables to display collected data summaries — never prose lists.
- Be **proactive**: when you already have a data point (timezone, location, etc.), STATE it and ask for confirmation, never ask open-endedly.
- If the user corrects something, acknowledge it warmly: "Got it, I've updated that."
- Only discuss topics related to net2phone onboarding and CCaaS configuration. Politely redirect off-topic questions.
- Never re-ask for data already present in the "Data collected so far" section.
- After every tool call, acknowledge the result naturally in your response.
- End each message with a clear next step or question.`;
}

// ── SSE helper ────────────────────────────────────────────────────────────────

function sseResponse(readable: ReadableStream) {
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function sseErrorResponse(message: string) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`)
      );
      controller.close();
    },
  });
  return sseResponse(readable);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sseErrorResponse("ANTHROPIC_API_KEY is not configured. Add it to .env.local.");
  }

  let body: {
    messages: Anthropic.MessageParam[];
    stage: string;
    config: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return sseErrorResponse("Invalid JSON body.");
  }

  const client = new Anthropic({ apiKey });

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(body.stage ?? "welcome_scrape", body.config ?? {}),
      tools: TOOLS,
      messages: body.messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text_delta", text })}\n\n`)
          );
        });

        try {
          const msg = await stream.finalMessage();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "message_complete",
                stop_reason: msg.stop_reason,
                content: msg.content,
              })}\n\n`
            )
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Stream error";
          console.error("[concierge-agent] stream error:", errMsg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`)
          );
        }

        controller.close();
      },
    });

    return sseResponse(readable);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic API error";
    console.error("[concierge-agent]", msg);
    return sseErrorResponse(msg);
  }
}
