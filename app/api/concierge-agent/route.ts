import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ── Tool definitions ──────────────────────────────────────────────────────────
//
// Concierge-specific tools (executed client-side) + a subset of n2p tools
// that the AI may call during the final build step.

const TOOLS: Anthropic.Tool[] = [
  // ── State-machine controls (client executes these) ──────────────────────────
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
            "Partial OnboardingData object. Top-level keys: name, companyName, websiteUrl, scraped, holidays, portingQueue, users, departments, routingType, licensingVerified, hasHardphones.",
        },
      },
      required: ["patch"],
    },
  },

  // ── Data-gathering tools (client executes these via mock/real backends) ──────
  {
    name: "research_website",
    description:
      "Analyze a company website URL and extract: city/location, timezone, business hours, and phone numbers. Call this as soon as you have the website URL — don't wait for the user to provide data you can scrape.",
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

  // ── net2phone account tools (client calls /api/n2p-tools) ───────────────────
  {
    name: "get_account_summary",
    description:
      "Get the current account overview: total DIDs, available numbers, and max user seats. Useful at the start to understand account capacity.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_next_extension",
    description: "Get the next available extension number for a new user.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_schedule",
    description:
      "Create a business-hours schedule from the scraped or confirmed hours. Called during the build step.",
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
    description:
      "Build the full call routing flow (schedule + ring group or call queue). Called during the final build step.",
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
    description:
      "Search net2phone support articles for product questions. Use when the user asks about a feature, pricing, or setup guidance outside the current step.",
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
- As SOON as you have the URL, call research_website(url) immediately — do not ask for timezone, location, or hours; scrape them.
- After research_website returns, call update_config with the scraped data, then call advance_stage.`,

    verification_holidays: `You are at the VERIFY & HOLIDAYS stage. You have already scraped the website.
- Proactively present what you found (location, timezone, hours, phones) in a markdown table.
- Frame it as "I found X — does this look right?" rather than asking open questions.
- Allow the user to correct any field inline.
- Ask ONE question: "Should I load standard public holidays into the schedule?"
- Once confirmed (or declined), call update_config with any edits + holidays intent, then call advance_stage.`,

    porting: `You are at the PORTING stage. Phone numbers found: ${JSON.stringify((config as { scraped?: { phones?: unknown[] } })?.scraped?.phones ?? [])}.
- List the discovered phone numbers and ask which ones to port.
- If none were found, explain and let the user enter numbers manually.
- Once the user selects numbers (or skips), call update_config with portingQueue, then call advance_stage.`,

    user_ingestion: `You are at the USER INGESTION stage.
- Explain the two options: type names in chat one by one, or use the CSV upload button.
- If the user types names/emails, collect them and call update_config with users array incrementally.
- When the user says they're done adding users (or confirms a CSV), call advance_stage.
- The UI also has a manual form widget — mention it as an option.`,

    architecture_hardware: `You are at the ARCHITECTURE stage. Users collected: ${JSON.stringify((config as { users?: unknown[] })?.users ?? [])}.
- Ask what departments the company has (Sales, Support, etc.).
- If users exist, ask which department each belongs to.
- Ask: "Do your team members use physical desk phones?"
- If yes, ask for model and MAC address per user.
- Call update_config with departments, user department assignments, hasHardphones, then call advance_stage.`,

    licensing: `You are at the LICENSING stage.
- Explain the difference: Ring Groups (included, rings all at once) vs Call Queues (requires license, callers wait in line).
- Ask which they prefer.
- If they choose Call Queues, immediately call check_licensing("call_queues").
  - If eligible: confirm and proceed.
  - If NOT eligible: explain and suggest Ring Groups as a free alternative.
- Call update_config with routingType + licensingVerified, then call advance_stage.`,

    final_blueprint: `You are at the FINAL BLUEPRINT stage.
- Present a comprehensive markdown summary table of everything collected.
- Ask: "Ready for me to build this out?"
- When they confirm, call apply_configuration({ confirm: true }).
- After apply_configuration returns success, call advance_stage.
- If anything looks wrong to the user, help them navigate back to fix it.`,

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
6. **licensing** — Ring Groups vs Call Queues
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: {
    messages: Anthropic.MessageParam[];
    stage: string;
    config: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(body.stage ?? "welcome_scrape", body.config ?? {}),
      tools: TOOLS,
      messages: body.messages,
    });
    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic API error";
    console.error("[concierge-agent]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
