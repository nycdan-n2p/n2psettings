import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { extractAnthropicText } from "@/lib/server/type-guards";

// CDR analysis can take up to 2 minutes for large files.
export const maxDuration = 120;

const client = new Anthropic();

// Truncate CDR to a safe token limit (~800 rows max)
function truncateCsv(csv: string, maxChars = 40_000): string {
  if (csv.length <= maxChars) return csv;
  const truncated = csv.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  return truncated.slice(0, lastNewline) + "\n[... truncated for analysis ...]";
}

export async function POST(req: NextRequest) {
  // Require a valid Bearer token — prevents unauthenticated callers from
  // consuming paid Anthropic credits.
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 CDR analyses per minute per client IP (expensive operation).
  const rl = checkRateLimit(getClientKey(req), "analyze-cdr", 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before uploading another CDR." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // Guard against excessively large request bodies before parsing JSON.
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 5_000_000) {
    return NextResponse.json({ error: "Request body too large (max 5 MB)." }, { status: 413 });
  }

  let csvText: string;
  try {
    ({ csvText } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!csvText?.trim()) {
    return NextResponse.json({ error: "csvText is required." }, { status: 400 });
  }

  const safecsv = truncateCsv(csvText);

  const prompt = `You are a call center data analyst. Analyze the following CDR (Call Detail Record) CSV and return a JSON object.

The CSV columns are typically: Call_ID, Timestamp, Direction, Caller_Number, Dialed_Number, Agent_Name, Ext, Talk_Time_Sec, Hold_Time_Sec, Status, Queue_Name, Reason

Return ONLY a valid JSON object — no explanation, no markdown fences, no extra text.

Required output fields:

- agents: array of { name: string, extension: string } — unique agents found (exclude "None", nulls, blanks). Split full names like "Dr. Aris" as-is for the name field. Extension is the Ext column value.
- inboundNumbers: array of strings — unique Dialed_Number values that appear on inbound calls (these are likely the company's main numbers and candidates for porting).
- queues: array of strings — unique Queue_Name values (exclude "None", "After_Hours", null, empty).
- insights: array of strings — up to 6 key observations. Look for:
  * After-hours missed calls (Status=Missed with After_Hours queue or timestamps after business hours)
  * High abandon rates (Status=Abandoned, high hold times)
  * Queue congestion or overflow (Reason contains Overflow, Congestion, Wait_Time_Exceeded)
  * Peak call hours
  * Agents with very high call volumes
  * Short staffing patterns
  Format each as a complete sentence, e.g. "Heavy after-hours missed calls detected on all 3 days after 17:00, totaling N missed calls."

- recommendations: object with:
  * routingType: "ring_groups" or "call_queues" — use call_queues if abandon rate > 10% or avg hold time > 3 min, otherwise ring_groups
  * strategy: "ring_all" | "round_robin" | "longest_idle" | "linear" | "fewest_calls" — pick based on patterns
  * afterHoursAction: "voicemail" or "greeting" — use greeting if there are significant after-hours missed calls
  * welcomeMenuEnabled: boolean — true if multiple queues/departments were detected
  * suggestedGreeting: string — a suggested TTS greeting using "our company" as placeholder, mention the queues found. e.g. "Thank you for calling. Press 1 for Front Desk, Press 2 for Surgery Line."
  * menuOptions: array of { key: string, destinationType: "department", destinationName: string } — one per queue found, keys starting at "1"

- summary: string — a 2-3 sentence natural language summary written in first person from the AI agent's perspective, e.g. "Based on your CDR, I found 5 agents: Sarah (101), Mike (102), Elena (103), Jessica (104), and Dr. Aris (107). I also noticed significant after-hours missed calls and queue congestion — I recommend setting up a Call Queue with Round Robin routing and a voicemail greeting after hours."

CDR data:
${safecsv}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = extractAnthropicText(response.content);
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      console.error("[analyze-cdr] Non-JSON response:", raw.slice(0, 500));
      return NextResponse.json(
        { error: "Analysis returned non-JSON response.", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic API error";
    console.error("[analyze-cdr]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
