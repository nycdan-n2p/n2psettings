import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── Discovery ───────────────────────────────────────────────────────────────
  {
    name: "get_account_summary",
    description:
      "Get the current account overview: total DIDs, available numbers, and max user seats. Call this at the start of a session or when assessing capacity.",
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
    name: "get_ring_group",
    description:
      "Get full details for a ring group including routing (time blocks, tiers, final tier). Use when building call flows or inspecting existing config.",
    input_schema: {
      type: "object",
      properties: {
        ringGroupId: { type: "string", description: "Ring group ID from list_ring_groups." },
      },
      required: ["ringGroupId"],
    },
  },
  {
    name: "create_ring_group",
    description:
      "Create a new ring group. After creation, use set_ring_group_members or add_user_to_ring_group to add members.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Ring group name, e.g. 'Sales Team'." },
      },
      required: ["name"],
    },
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
  {
    name: "set_ring_group_members",
    description:
      "Set all members of a ring group at once (replaces existing members). Use for bulk assignment.",
    input_schema: {
      type: "object",
      properties: {
        ringGroupId: { type: "string", description: "Ring group ID." },
        userIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of user IDs to set as members.",
        },
      },
      required: ["ringGroupId", "userIds"],
    },
  },
  {
    name: "set_ring_group_tiers",
    description:
      "Configure tiered escalation on a ring group. Each tier has a set of users and a ring count before escalating to the next tier.",
    input_schema: {
      type: "object",
      properties: {
        ringGroupId: { type: "string", description: "Ring group ID." },
        tiers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tier: { type: "number", description: "Tier number (1, 2, 3...)." },
              rings: { type: "number", description: "Number of rings before escalating." },
              userIds: {
                type: "array",
                items: { type: "number" },
                description: "User IDs in this tier.",
              },
            },
          },
          description: "Array of tier configs.",
        },
      },
      required: ["ringGroupId", "tiers"],
    },
  },

  // ── Call queues ──────────────────────────────────────────────────────────────
  {
    name: "list_call_queues",
    description: "List all call queues on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_call_queue",
    description:
      "Create a new call queue. After creation, use set_call_queue_agents to add agents and update_call_queue to configure strategy.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Call queue name, e.g. 'Support Queue'." },
      },
      required: ["name"],
    },
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
  {
    name: "set_call_queue_agents",
    description:
      "Set all agents of a call queue at once (replaces existing agents). Use for bulk assignment.",
    input_schema: {
      type: "object",
      properties: {
        queueId: { type: "string", description: "Call queue ID." },
        userIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of user IDs to set as agents.",
        },
      },
      required: ["queueId", "userIds"],
    },
  },
  {
    name: "update_call_queue",
    description:
      "Update call queue settings: ring strategy, max wait time, max capacity.",
    input_schema: {
      type: "object",
      properties: {
        queueId: { type: "string", description: "Call queue ID." },
        ring_strategy_type: {
          type: "string",
          enum: ["ring_all", "round_robin", "longest_idle", "linear", "fewest_calls"],
          description: "How calls are distributed to agents.",
        },
        max_wait_time_seconds: { type: "number", description: "Max seconds a caller waits in queue (e.g. 300)." },
        max_capacity: { type: "number", description: "Max callers allowed in the queue (e.g. 10)." },
      },
      required: ["queueId"],
    },
  },

  // ── Departments ──────────────────────────────────────────────────────────────
  {
    name: "list_departments",
    description: "List all departments on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_department",
    description: "Create a new department on the account.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Department name, e.g. 'Sales'." },
      },
      required: ["name"],
    },
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

  // ── Welcome menus (virtual assistants / auto-attendants) ───────────────────
  {
    name: "list_virtual_assistants",
    description: "List all welcome menus (auto-attendants / virtual assistants) on the account.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_virtual_assistant",
    description:
      "Create a new welcome menu (auto-attendant). After creation, use generate_tts_greeting for the greeting and set_menu_options for DTMF key routing.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Menu name, e.g. 'Main Menu'." },
      },
      required: ["name"],
    },
  },
  {
    name: "generate_tts_greeting",
    description:
      "Generate a text-to-speech greeting audio for a welcome menu.",
    input_schema: {
      type: "object",
      properties: {
        virtualAssistantId: { type: "string", description: "Welcome menu ID." },
        text: { type: "string", description: "Greeting text, e.g. 'Thank you for calling Acme. Press 1 for Sales...'" },
      },
      required: ["virtualAssistantId", "text"],
    },
  },
  {
    name: "set_menu_options",
    description:
      "Set DTMF key routing options on a welcome menu. Maps key presses to destinations (departments, ring groups, voicemail, directory, users).",
    input_schema: {
      type: "object",
      properties: {
        virtualAssistantId: { type: "string", description: "Welcome menu ID." },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "DTMF key (1-9, 0, *, #)." },
              destinationType: {
                type: "string",
                enum: ["department", "ring_group", "call_queue", "voicemail", "directory", "user"],
              },
              destinationName: { type: "string", description: "Name of the destination." },
            },
          },
          description: "Array of DTMF key-to-destination mappings.",
        },
      },
      required: ["virtualAssistantId", "options"],
    },
  },

  // ── Licensing ──────────────────────────────────────────────────────────────
  {
    name: "list_licenses",
    description:
      "List all licenses on the account. Use to check if a feature like Call Queues is available before creating one.",
    input_schema: { type: "object", properties: {}, required: [] },
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

  // ── Schedules ──────────────────────────────────────────────────────────────
  {
    name: "create_schedule",
    description:
      "Create a schedule with time rules (e.g. work hours Mon-Fri 9-5). Used for time-based call routing.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Schedule name, e.g. 'Work Hours'." },
        timezone: { type: "string", description: "Timezone abbreviation, e.g. EST, America/New_York." },
        rules: {
          type: "array",
          description: "Schedule rules. Each: { days: { weekDays: [1-7] }, time: { start: '09:00 AM', end: '05:00 PM' } }. 1=Sun, 2=Mon, ... 7=Sat.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              days: {
                type: "object",
                properties: {
                  weekDays: { type: "array", items: { type: "number" } },
                  dates: { type: "array", items: { type: "string" } },
                  isRange: { type: "boolean" },
                },
              },
              time: {
                type: "object",
                properties: {
                  start: { type: "string" },
                  end: { type: "string" },
                },
              },
            },
          },
        },
      },
      required: ["name"],
    },
  },

  // ── Call flow builder ───────────────────────────────────────────────────────
  {
    name: "build_call_flow",
    description:
      "Build a call flow from a structured request. Use when the user describes routing like 'main number to X during work hours, Y after hours, no answer to voicemail'. Creates schedules, ring groups, and time-based routing.",
    input_schema: {
      type: "object",
      properties: {
        mainNumber: {
          type: "string",
          description: "Phone number (E.164) or 'main' to use first available. May require manual assignment after.",
        },
        workHours: {
          type: "object",
          description: "Routing during work hours.",
          properties: {
            schedule: {
              type: "object",
              properties: {
                weekDays: { type: "array", items: { type: "number" }, description: "1=Sun..7=Sat. e.g. [2,3,4,5,6] for Mon-Fri." },
                start: { type: "string", description: "e.g. 09:00 AM" },
                end: { type: "string", description: "e.g. 05:00 PM" },
              },
            },
            destination: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["ring_group", "department", "virtual_assistant", "call_queue"] },
                name: { type: "string", description: "Name of ring group, department, welcome menu, or call queue." },
              },
            },
          },
        },
        afterHours: {
          type: "object",
          description: "Routing after hours.",
          properties: {
            destination: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["ring_group", "department", "voicemail", "external"] },
                name: { type: "string" },
                number: { type: "string", description: "For external forwarding, the phone number." },
              },
            },
          },
        },
        noAnswer: {
          type: "object",
          description: "Overflow when no one answers.",
          properties: {
            type: { type: "string", enum: ["voicemail"] },
            target: { type: "string", enum: ["department", "user"], description: "Optional. Department or user for voicemail." },
          },
        },
      },
      required: [],
    },
  },

  // ── Support knowledge (fallback) ───────────────────────────────────────────
  {
    name: "search_support",
    description:
      "Search net2phone support articles. ONLY use this as a LAST RESORT when the user asks about something you cannot do directly with tools — such as billing, SIP trunking details, or advanced features not covered by your other tools.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'SIP trunking', 'billing', 'E911 setup'",
        },
      },
      required: ["query"],
    },
  },
];

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(onboardingSummary?: string): string {
  const onboardingContext = onboardingSummary
    ? `\n\n## Onboarding context\nThe admin just completed the Setup Concierge onboarding. Here is what was configured:\n${onboardingSummary}\n\nWhen starting a new session right after onboarding:\n- Greet them warmly and acknowledge the onboarding they just completed.\n- Proactively mention any gaps or next steps, for example:\n  - If no users were added: "I see we didn't add any team members during setup — want to add some now?"\n  - If porting was skipped: "Number porting was skipped — want to start that process?"\n  - If no welcome menu: "You don't have a welcome menu yet — want me to set one up?"\n  - If only softphones: "Everyone is on softphones — if you get desk phones later, I can help configure those."\n- Don't repeat all the details — just highlight what's actionable.\n`
    : "";

  return `You are the **net2phone Sidekick** — an AI assistant for UCaaS account administrators. You can **do** almost everything an admin needs, not just answer questions.

## Core principle: ACTION FIRST
When the admin asks "how do I add a ring group?" or "I need to set up a call queue" — **DO IT FOR THEM**. Don't search support articles. You have the tools to create ring groups, call queues, welcome menus, departments, users, and full call flows directly.

Only use search_support as a **last resort** for topics you genuinely cannot handle with tools — such as billing questions, SIP trunking specifics, E911 compliance, or advanced features not covered by your tools.

## What you can do (use these tools!)
- **Users**: Create users (get_next_extension → create_user), assign phone numbers, search existing users
- **Ring groups**: Create (create_ring_group), list, add members, set tiers with escalation (set_ring_group_tiers)
- **Call queues**: Create (create_call_queue), list, add agents, configure strategy/wait/capacity (update_call_queue)
- **Departments**: Create (create_department), list, assign users
- **Welcome menus**: Create auto-attendants (create_virtual_assistant), generate TTS greetings, set DTMF key routing (set_menu_options)
- **Call flows**: Build complete call routing (build_call_flow) — schedule-based routing, after-hours, no-answer overflow
- **Schedules**: Create time-based schedules for routing
- **Licensing**: Check available licenses (list_licenses) before creating call queues
- **Analytics**: User and account call statistics
- **Bulk CSV**: Process uploaded CSVs to create users in batch

## Workflow: Adding users
1. Ask for name and email (or accept CSV upload)
2. Call get_next_extension for a suggested extension
3. Optionally offer a phone number (get_available_numbers)
4. Call create_user
5. Offer to assign to a department, ring group, or call queue
6. Ask if there are more users to add
7. Check license capacity (get_account_summary) if adding many users

## Workflow: Creating a ring group
1. Ask for a name (suggest based on department if known)
2. Call create_ring_group
3. Ask who should be in it — search_users to find them
4. Call add_user_to_ring_group or set_ring_group_members
5. Ask: "Should all members ring at once, or do you want tiered escalation?"
6. If tiered: collect tier structure, call set_ring_group_tiers

## Workflow: Creating a call queue
1. Check licensing: call list_licenses — if no queue license, explain and suggest ring groups instead
2. Ask for a name, ring strategy, max wait, max capacity
3. Call create_call_queue, then update_call_queue with settings
4. Ask who should be agents, search and add them

## Workflow: Setting up a welcome menu
1. Ask: "What should callers hear?" — suggest a greeting based on company/departments
2. Call create_virtual_assistant
3. Call generate_tts_greeting with the greeting text
4. Ask about DTMF routing — "Press 1 for Sales, Press 2 for Support..."
5. Call set_menu_options with the key mappings
6. Offer to wire it into a call flow (build_call_flow)

## Workflow: Call flow
1. Clarify: main number, work hours, destinations, after-hours behavior
2. Verify ring groups/departments exist (list them)
3. Call build_call_flow
4. Summarize and explain any manual steps

## Style
- Be brief and direct. 2–4 sentences per response max unless showing data.
- Use markdown tables for lists of users, groups, queues, etc.
- Format phone numbers as +1 (XXX) XXX-XXXX.
- After completing an action, confirm with a short summary and ask "What's next?"
- If a tool error occurs, explain simply and offer to retry or try an alternative.
- Be proactive: when you see remaining license seats, mention them. When you create a ring group, offer to wire it into a call flow.${onboardingContext}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { messages: Anthropic.MessageParam[]; onboardingSummary?: string };
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
      system: buildSystemPrompt(body.onboardingSummary),
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
