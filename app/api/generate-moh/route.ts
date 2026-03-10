import { NextRequest, NextResponse } from "next/server";

/**
 * AI Music-on-Hold generator using Suno API.
 *
 * Configure in .env.local:
 *   SUNO_API_BASE_URL=https://apibox.erweima.ai   (sunoapi.org hosted service)
 *   SUNO_API_KEY=your_api_key_here
 *
 * Compatible with sunoapi.org (apibox.erweima.ai) as well as self-hosted
 * gcui-art/suno-api instances.
 *
 * Request:  POST { prompt, style?, title?, instrumental }
 * Response: { audioUrl, title, imageUrl?, id }
 */

interface SunoGenerateBody {
  prompt: string;
  style?: string;
  title?: string;
  instrumental: boolean;
}

// ── sunoapi.org (apibox.erweima.ai) response shapes ──────────────────────────
interface SunoTaskResponse {
  code: number;
  msg?: string;
  data?: {
    taskId?: string;
    // Some providers return the tracks directly
    sunoData?: SunoTrack[];
  };
}

interface SunoRecordResponse {
  code: number;
  data?: {
    status: "SUCCESS" | "IN_PROGRESS" | "FAILED" | "PENDING" | string;
    response?: {
      sunoData?: SunoTrack[];
    };
    // flat format (gcui-art style)
    sunoData?: SunoTrack[];
  };
}

// ── gcui-art/suno-api track shape ─────────────────────────────────────────────
interface SunoTrack {
  id?: string;
  title?: string;
  audio_url?: string;
  image_url?: string;
  status?: string;
  duration?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE_URL = (process.env.SUNO_API_BASE_URL ?? "").replace(/\/$/, "");
const API_KEY  = process.env.SUNO_API_KEY ?? "";

function sunoHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

/** Try sunoapi.org style first, then gcui-art style */
async function generateTrack(body: SunoGenerateBody): Promise<{ taskId?: string; tracks?: SunoTrack[] }> {
  // sunoapi.org format: POST /api/v1/generate
  const sunoOrgPayload = {
    prompt: body.prompt,
    style: body.style ?? "",
    title: body.title ?? "Hold Music",
    customMode: !!(body.style || body.title),
    instrumental: body.instrumental,
    model: "chirp-v4",
  };

  const res = await fetch(`${BASE_URL}/api/v1/generate`, {
    method: "POST",
    headers: sunoHeaders(),
    body: JSON.stringify(sunoOrgPayload),
  });

  if (res.ok) {
    const data: SunoTaskResponse = await res.json();
    if (data.data?.taskId) return { taskId: data.data.taskId };
    if (data.data?.sunoData?.length) return { tracks: data.data.sunoData };
  }

  // Fallback: gcui-art format POST /api/generate
  const gcuiPayload = {
    prompt: body.prompt,
    tags: body.style ?? "",
    title: body.title ?? "Hold Music",
    make_instrumental: body.instrumental,
    wait_audio: false,
  };

  const res2 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: sunoHeaders(),
    body: JSON.stringify(gcuiPayload),
  });

  if (!res2.ok) {
    const text = await res2.text().catch(() => "");
    throw new Error(`Suno API error ${res2.status}: ${text.slice(0, 200)}`);
  }

  const data2 = await res2.json();
  // gcui-art returns an array of tracks directly (with wait_audio=false they may lack audio_url)
  const arr = Array.isArray(data2) ? data2 : [];
  const ids = arr.map((t: SunoTrack) => t.id).filter(Boolean).join(",");
  return { taskId: ids || undefined, tracks: arr };
}

/** Poll sunoapi.org-style task status */
async function pollTaskStatus(taskId: string): Promise<SunoTrack | null> {
  const res = await fetch(`${BASE_URL}/api/v1/generate/record-info?taskId=${taskId}`, {
    headers: sunoHeaders(),
  });
  if (!res.ok) return null;
  const data: SunoRecordResponse = await res.json();
  const tracks =
    data.data?.response?.sunoData ??
    data.data?.sunoData ??
    [];
  const ready = tracks.find((t) => t.audio_url);
  if (ready) return ready;
  if (data.data?.status === "FAILED") throw new Error("Suno generation failed");
  return null;
}

/** Poll gcui-art-style GET /api/get?ids=... */
async function pollGcuiTrack(ids: string): Promise<SunoTrack | null> {
  const res = await fetch(`${BASE_URL}/api/get?ids=${encodeURIComponent(ids)}`, {
    headers: sunoHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const arr: SunoTrack[] = Array.isArray(data) ? data : [];
  return arr.find((t) => t.audio_url && t.status !== "error") ?? null;
}

// ── GET: proxy-download Suno audio URL server-side (avoids browser CORS) ─────
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
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

// ── POST: generate music via Suno API ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json(
      { error: "SUNO_API_BASE_URL is not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  let body: SunoGenerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const result = await generateTrack(body);

    // If tracks returned immediately (wait_audio=true scenario), check for audio_url
    const immediate = result.tracks?.find((t) => t.audio_url);
    if (immediate?.audio_url) {
      return NextResponse.json({
        id: immediate.id,
        audioUrl: immediate.audio_url,
        imageUrl: immediate.image_url ?? null,
        title: immediate.title ?? body.title ?? "AI Hold Music",
      });
    }

    // Poll until we have an audio URL (max ~3 min)
    const taskId = result.taskId ?? result.tracks?.map((t) => t.id).filter(Boolean).join(",");
    if (!taskId) {
      throw new Error("No task ID returned from Suno API");
    }

    const isOrgStyle = taskId.length < 40; // UUIDs are longer, gcui IDs are short strings
    const pollFn = isOrgStyle ? pollTaskStatus : pollGcuiTrack;

    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000)); // wait 5s between polls
      const track = await pollFn(taskId);
      if (track?.audio_url) {
        return NextResponse.json({
          id: track.id,
          audioUrl: track.audio_url,
          imageUrl: track.image_url ?? null,
          title: track.title ?? body.title ?? "AI Hold Music",
        });
      }
    }

    throw new Error("Music generation timed out after 3 minutes. Try again.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Music generation failed";
    console.error("[generate-moh]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
