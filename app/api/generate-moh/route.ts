import { NextRequest, NextResponse } from "next/server";

/**
 * AI Music-on-Hold generator using Suno API.
 *
 * Official: https://docs.sunoapi.org/suno-api/quickstart
 *   Base: https://api.sunoapi.org | Key: https://sunoapi.org/api-key
 *
 * API Box: https://docs.api.box/suno-api/generate-music
 *   Base: https://apibox.erweima.ai | Key: https://api.box/api-key
 *
 * .env.local:
 *   SUNO_API_BASE_URL=https://api.sunoapi.org
 *   SUNO_API_KEY=your_api_key_here
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

// ── sunoapi.org response shapes (docs.sunoapi.org/suno-api/quickstart) ─────────
interface SunoRecordResponse {
  code: number;
  data?: {
    status: "SUCCESS" | "IN_PROGRESS" | "FAILED" | "PENDING" | string;
    response?: {
      data?: SunoTrack[];      // official docs format
      sunoData?: SunoTrack[];  // alternate
    };
    sunoData?: SunoTrack[];    // flat gcui-art style
  };
}

// ── Track shape (supports snake_case and camelCase from different providers) ───
interface SunoTrack {
  id?: string;
  title?: string;
  audio_url?: string;
  audioUrl?: string;  // api.box uses camelCase
  image_url?: string;
  imageUrl?: string;
  status?: string;
  duration?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE_URL = (process.env.SUNO_API_BASE_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.SUNO_API_KEY ?? "";
/** Override if your provider uses a different path, e.g. /api/v1/generate or /api/generate */
const GENERATE_PATH = process.env.SUNO_API_GENERATE_PATH?.replace(/^\//, "");

function sunoHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (API_KEY) (h as Record<string, string>)["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

/** Get audio URL from track (api.box uses audioUrl, others use audio_url) */
function getAudioUrl(t: SunoTrack): string | undefined {
  return t.audio_url ?? t.audioUrl;
}

/** Try sunoapi.org / api.box style first, then gcui-art. Use SUNO_API_GENERATE_PATH to override. */
async function generateTrack(body: SunoGenerateBody): Promise<{ taskId?: string; tracks?: SunoTrack[] }> {
  const sunoOrgPayload = {
    prompt: body.prompt,
    style: body.style ?? "",
    title: body.title ?? "Hold Music",
    customMode: !!(body.style || body.title),
    instrumental: body.instrumental,
    model: "V4_5ALL",
    callBackUrl: "https://example.com/callback", // required by api.box (docs.api.box) - we poll instead
  };

  const gcuiPayload = {
    prompt: body.prompt,
    tags: body.style ?? "",
    title: body.title ?? "Hold Music",
    make_instrumental: body.instrumental,
    wait_audio: false,
  };

  const attempts: { path: string; payload: object; isSunoOrg: boolean }[] = GENERATE_PATH
    ? [{ path: GENERATE_PATH, payload: sunoOrgPayload, isSunoOrg: true }]
    : [
        { path: "api/v1/generate", payload: sunoOrgPayload, isSunoOrg: true },
        { path: "api/v2/generate", payload: sunoOrgPayload, isSunoOrg: true },
        { path: "api/generate", payload: gcuiPayload, isSunoOrg: false },
      ];

  let lastErr: string | null = null;
  for (const { path, payload, isSunoOrg } of attempts) {
    const url = `${BASE_URL}/${path}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: sunoHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (isSunoOrg) {
          if (data.data?.taskId) return { taskId: data.data.taskId };
          if (data.data?.sunoData?.length) return { tracks: data.data.sunoData };
        } else {
          const arr = Array.isArray(data) ? data : [];
          const ids = arr.map((t: SunoTrack) => t.id).filter(Boolean).join(",");
          return { taskId: ids || undefined, tracks: arr };
        }
      }
      lastErr = `${res.status} at ${url}: ${(await res.text().catch(() => "")).slice(0, 150)}`;
    } catch (e) {
      lastErr = `Failed to reach ${url}: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  throw new Error(`Suno API error - all paths failed. Last: ${lastErr ?? "unknown"}`);
}

/** Poll sunoapi.org-style task status */
async function pollTaskStatus(taskId: string): Promise<SunoTrack | null> {
  const res = await fetch(`${BASE_URL}/api/v1/generate/record-info?taskId=${taskId}`, {
    headers: sunoHeaders(),
  });
  if (!res.ok) return null;
  const data: SunoRecordResponse = await res.json();
  const tracks =
    data.data?.response?.data ??
    data.data?.response?.sunoData ??
    data.data?.sunoData ??
    [];
  const ready = tracks.find((t) => getAudioUrl(t));
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
  return arr.find((t) => getAudioUrl(t) && t.status !== "error") ?? null;
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
    const immediate = result.tracks?.find((t) => getAudioUrl(t));
    const immediateUrl = immediate ? getAudioUrl(immediate) : undefined;
    if (immediateUrl) {
      return NextResponse.json({
        id: immediate!.id,
        audioUrl: immediateUrl,
        imageUrl: immediate!.image_url ?? immediate!.imageUrl ?? null,
        title: immediate!.title ?? body.title ?? "AI Hold Music",
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
      const trackUrl = track ? getAudioUrl(track) : undefined;
      if (trackUrl) {
        return NextResponse.json({
          id: track!.id,
          audioUrl: trackUrl,
          imageUrl: track!.image_url ?? track!.imageUrl ?? null,
          title: track!.title ?? body.title ?? "AI Hold Music",
        });
      }
    }

    throw new Error("Music generation timed out after 3 minutes. Try again.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Music generation failed";
    console.error("[generate-moh]", message, err);
    return NextResponse.json(
      {
        error: message,
        hint: !BASE_URL ? "Add SUNO_API_BASE_URL and SUNO_API_KEY to .env.local" : undefined,
      },
      { status: 500 }
    );
  }
}
