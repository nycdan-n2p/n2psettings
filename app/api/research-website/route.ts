import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkSsrf } from "@/lib/server/ssrf-guard";
import { checkRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { extractAnthropicText } from "@/lib/server/type-guards";

// Website fetch + AI analysis; 60s is ample but allow headroom.
export const maxDuration = 60;

const client = new Anthropic();

// ── HTML → text: strip tags, collapse whitespace, trim to a safe length ───────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 12000); // ~3k tokens — enough for Claude to extract what we need
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit: 20 scrapes per minute per client IP.
  const rl = checkRateLimit(getClientKey(req), "research-website", 20, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  // Normalise the URL
  const normalised = url.startsWith("http") ? url : `https://${url}`;

  // Block SSRF — reject private IPs, loopback, metadata endpoints, etc.
  const ssrf = checkSsrf(normalised);
  if (!ssrf.ok) {
    return NextResponse.json({ error: `Invalid URL: ${ssrf.reason}` }, { status: 400 });
  }

  // ── Step 1: Fetch the website ──────────────────────────────────────────────

  let pageText = "";
  try {
    const res = await fetch(normalised, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; N2PSetupBot/1.0; +https://net2phone.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Website returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    pageText = htmlToText(html);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not fetch website: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  if (!pageText.trim()) {
    return NextResponse.json(
      { error: "Website returned empty content." },
      { status: 502 }
    );
  }

  // ── Step 2: Ask Claude to extract structured data ─────────────────────────

  const prompt = `You are a data extraction assistant. From the website text below, extract the following fields as JSON.

Return ONLY a valid JSON object — no explanation, no markdown fences, no extra text.

Required fields:
- companyName: string — official company/business name
- location: string — city and state/country (e.g. "New York, NY" or "Toronto, ON")
- timezone: string — timezone abbreviation (e.g. "EST", "PST", "CST") inferred from the location
- timezoneIana: string — IANA timezone (e.g. "America/New_York") inferred from the location
- hours: object — business hours by day name. Keys: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday. Values: time range like "9:00 AM – 5:00 PM" or "Closed"
- phones: array of strings — all phone numbers found on the page, in E.164 format (e.g. "+12125551234"). Empty array if none found.
- address: string — full street address if present, otherwise empty string

If a field cannot be determined from the page content, use sensible defaults:
- hours default: Mon–Fri "9:00 AM – 5:00 PM", Sat/Sun "Closed"
- timezone/timezoneIana: infer from location or default to "EST"/"America/New_York"
- phones: []
- address: ""

Website URL: ${normalised}

Website text:
${pageText}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = extractAnthropicText(response.content);

    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Claude returned non-JSON response.", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anthropic API error";
    console.error("[research-website]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
