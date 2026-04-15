import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkSsrf } from "@/lib/server/ssrf-guard";

/**
 * AI Music-on-Hold generator using ElevenLabs Music API.
 *
 * Docs: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music
 * API: https://elevenlabs.io/docs/api-reference/music/compose
 *
 * .env / Vercel:
 *   N2P_API_ELEVEN_LABS=your_api_key_here
 *   BLOB_READ_WRITE_TOKEN=... (optional, for call-queue hold music URLs)
 *
 * Request:  POST { prompt, style?, title?, instrumental }
 * Response: { audioUrl, audioBase64, title }
 */

interface GenerateMohBody {
  prompt: string;
  style?: string;
  title?: string;
  instrumental: boolean;
}

const API_KEY = process.env.N2P_API_ELEVEN_LABS ?? "";
const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/music";

/** Default length for hold music (15 seconds) */
const DEFAULT_MUSIC_LENGTH_MS = 15_000;

/** Build prompt from body (prompt + style) */
function buildPrompt(body: GenerateMohBody): string {
  const parts = [body.prompt.trim()];
  if (body.style?.trim()) parts.push(body.style.trim());
  if (body.instrumental) parts.push("instrumental only, no vocals");
  return parts.join(". ");
}

/** Generate music via ElevenLabs Music API */
async function generateWithElevenLabs(body: GenerateMohBody): Promise<ArrayBuffer> {
  const res = await fetch(`${ELEVENLABS_URL}?output_format=mp3_22050_32`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": API_KEY,
    },
    body: JSON.stringify({
      prompt: buildPrompt(body),
      music_length_ms: DEFAULT_MUSIC_LENGTH_MS,
      force_instrumental: body.instrumental,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.detail?.message ?? err.message ?? res.statusText ?? `HTTP ${res.status}`;
    throw new Error(`ElevenLabs API: ${msg}`);
  }

  return res.arrayBuffer();
}

// ── GET: proxy-download external audio URL (for backwards compatibility) ─────
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Only allow Vercel Blob storage URLs — this endpoint exists solely to
  // proxy hold-music files stored there. Reject anything else outright so
  // the allowed domain is an explicit allowlist, not just a blocklist.
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }
  // Belt-and-suspenders: also run the generic SSRF guard
  const ssrf = checkSsrf(url);
  if (!ssrf.ok) {
    return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString());
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("Content-Type") ?? "audio/mpeg";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "attachment",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: generate music via ElevenLabs ───────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "N2P_API_ELEVEN_LABS is not configured. Add it to Vercel env vars." },
      { status: 503 }
    );
  }

  let body: GenerateMohBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const buffer = await generateWithElevenLabs(body);
    const base64 = Buffer.from(buffer).toString("base64");
    const title = body.title?.trim() ?? "AI Hold Music";

    // Prefer Blob URL (call-queues need a fetchable URL); fallback to data URL
    let audioUrl: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(
        `moh/${Date.now()}-${title.replace(/\W+/g, "-").slice(0, 30)}.mp3`,
        new Blob([buffer], { type: "audio/mpeg" }),
        { access: "public" }
      );
      audioUrl = blob.url;
    } else {
      audioUrl = `data:audio/mpeg;base64,${base64}`;
    }

    return NextResponse.json({
      id: `elevenlabs-${Date.now()}`,
      audioUrl,
      audioBase64: base64,
      imageUrl: null,
      title,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Music generation failed";
    console.error("[generate-moh]", message, err);
    return NextResponse.json(
      {
        error: message,
        hint: !API_KEY ? "Add N2P_API_ELEVEN_LABS to Vercel env vars" : undefined,
      },
      { status: 500 }
    );
  }
}
