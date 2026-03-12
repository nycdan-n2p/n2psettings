import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── Discovery ───────────────────────────────────────────────────────────────
  {
    name: "get_account_summary",
    description:
      "Get the current account overview: total DIDs, available numbers, and max user seats. Call this at the start of a session.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_next_extension",
    description:
      "Get the next available extension number for a new user. Call before creating a user to suggest a sensible default.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_users",
    description:
      "Search for existing users on the account by name, email, or extension. Use this when the admin refers to someone by name for group/queue/department operations, or to look up a userId.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Partial name, email, or extension to search for.",
        },
      },
      required: ["query"],
    },
  },

  // ── Phone numbers ────────────────────────────────────────────────────────────
  {
    name: "get_available_numbers",
    description:
      "Fetch available phone numbers that can be assigned to users. Returns unassigned account DIDs first, then catalog numbers as overflow. Pass a limit to cap the list (default 8).",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max numbers to return (default 8)." },
      },
      required: [],
    },
  },

  // ── User management ──────────────────────────────────────────────────────────
  {
    name: "create_user",
    description:
      "Create a new user on the net2phone account. Optionally assign a phone number at the same time. Call get_next_extension first to suggest an extension.",
    input_schema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        extension: { type: "string", description: "3–6 digit extension (from get_next_extension)." },
        role: { type: "string", enum: ["user", "admin"], description: "Default: user." },
        timeZone: { type: "string", description: "e.g. America/New_York. Default: America/New_York." },
        phoneNumber: { type: "string", description: "Optional E.164/10-digit number to assign." },
      },
      required: ["firstName", "lastName", "email", "extension"],
    },
  },

  // ── Ring groups ──────────────────────────────────────────────────────────────
  {
    name: "list_ring_groups",
    description: "List all ring groups on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_user_to_ring_group",
    description:
      "Add an existing user to a ring group. Use search_users to get the userId if needed.",
    input_schema: {
      type: "object",
      properties: {
        ringGroupId: { type: "string", description: "Ring group ID." },
        userId: { type: "number", description: "User ID to add." },
      },
      required: ["ringGroupId", "userId"],
    },
  },

  // ── Call queues ──────────────────────────────────────────────────────────────
  {
    name: "list_call_queues",
    description: "List all call queues on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_user_to_call_queue",
    description:
      "Add an existing user as an agent to a call queue. Use search_users to get the userId if needed.",
    input_schema: {
      type: "object",
      properties: {
        queueId: { type: "string", description: "Call queue ID." },
        userId: { type: "number", description: "User ID to add as agent." },
      },
      required: ["queueId", "userId"],
    },
  },

  // ── Departments ──────────────────────────────────────────────────────────────
  {
    name: "list_departments",
    description: "List all departments on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "assign_user_to_department",
    description:
      "Assign an existing user to a department. Use search_users to get the userId if needed.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "number", description: "User ID to assign." },
        deptId: { type: "number", description: "Department ID." },
      },
      required: ["userId", "deptId"],
    },
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  {
    name: "get_user_call_stats",
    description:
      "Get call statistics for a user over a date range. Returns total calls, answered, missed, and average duration. Use search_users to get userId if needed.",
    input_schema: {
      type: "object",
      properties: {
        userId: { type: "number", description: "User ID to get stats for." },
        userName: { type: "string", description: "Display name (for context in response)." },
        days: {
          type: "number",
          description: "Number of days back to look. Default 30.",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_account_call_stats",
    description:
      "Get overall account-level call statistics for the last N days. Shows totals, top users, and department breakdown.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days back. Default 30." },
      },
      required: [],
    },
  },

  // ── Support knowledge ───────────────────────────────────────────────────────
  {
    name: "search_support",
    description:
      "Search net2phone support articles for product questions, how-to guides, and troubleshooting. Use when the user asks how to do something, about a feature, or needs help with setup.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'call forwarding', 'web calling', 'voicemail setup'",
        },
      },
      required: ["query"],
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for net2phone UCaaS account administrators. You help with onboarding and account management via a chat interface.

## Capabilities
- **Create users**: Collect name + email (extension auto-suggested, phone optional)
- **Assign numbers**: Show available DIDs and let admin pick
- **Ring groups**: List groups and add users to them
- **Call queues**: List queues and add agents
- **Departments**: List departments and assign users
- **Bulk users**: If the admin uploads a CSV, process each row sequentially using create_user
- **Call stats**: Pull analytics for individual users or the whole account
- **Support knowledge**: When the user asks how to do something, about a feature, or needs help, use search_support to find relevant articles from support.net2phone.com

## Workflow for adding a single user
1. Greet and call get_account_summary (once per session)
2. Collect first name, last name, email
3. Call get_next_extension → suggest it
4. Ask about phone number → call get_available_numbers → let them pick or skip
5. Call create_user
6. Offer to add to ring group / call queue / department
7. Ask if more people to add

## Workflow for bulk CSV
When you receive a list of users (from a CSV upload), process them one by one with create_user. Before starting, show the full list and ask for confirmation. Report success/failure after each.

## Workflow for group/queue/department operations
- If admin says "add John to Sales ring group": call search_users("John") to get userId, call list_ring_groups to find Sales, then add_user_to_ring_group
- If admin says "show me call stats for Jane": call search_users("Jane") to get userId, then get_user_call_stats

## Workflow for support/product questions
- When the user asks "how do I set up call forwarding?", "what is web calling?", "help with voicemail", or similar: call search_support with a relevant query, then summarize the results and include links to the articles.

## Style
- Be brief and direct. No walls of bullet points.
- Format phone numbers as +1 (XXX) XXX-XXXX.
- Format call durations as m:ss.
- After completing an action, confirm with a short summary and ask what's next.
- If a tool returns an error, explain it simply and ask if the admin wants to retry or skip.`;

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { messages: Anthropic.MessageParam[] };
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
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: body.messages,
    });
    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic API error";
    console.error("[onboarding-agent]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
