export interface EnvConfig {
  N2P_API_URL: string;
  N2P_API_V2_URL: string;
  N2P_API_AUTH_URL: string;
  N2P_API_N2P_URL: string;
  N2P_API_PROFILE_SETTINGS?: string;
  N2P_HUDDLE_URL?: string;
  N2P_WALLBOARD_URL?: string;
  N2P_AI_AGENT_URL?: string;
  N2P_COACH_URL?: string;
  N2P_MESSENGER_API_URL?: string;
  N2P_AUDIO_TRANSCODER_URL?: string;
}

const DEFAULTS: EnvConfig = {
  N2P_API_URL:     "https://app.net2phone.com/",
  N2P_API_V2_URL:  "https://app.net2phone.com/api/v2",
  N2P_API_AUTH_URL: "https://auth.net2phone.com",
  N2P_API_N2P_URL: "https://api.n2p.io/v2",
};

let cachedEnv: EnvConfig | null = null;

/**
 * Load environment configuration.
 *
 * On the server (Next.js API routes / server components): reads from process.env.
 * In the browser: returns defaults. Browser API calls always go through
 * /api/proxy* routes and never need the real backend URLs directly.
 *
 * The previous /env.json fetch strategy has been removed — it produced a 404
 * on Vercel because environment variables are baked into the build, not served
 * as a runtime JSON file.
 */
export async function loadEnv(): Promise<EnvConfig> {
  if (cachedEnv) return cachedEnv;
  cachedEnv = buildEnv();
  return cachedEnv;
}

export function getEnv(): EnvConfig {
  if (!cachedEnv) cachedEnv = buildEnv();
  return cachedEnv;
}

function buildEnv(): EnvConfig {
  // In the browser there is no process.env with server vars.
  // The browser never calls the real backend directly (always via /api/proxy*),
  // so returning defaults here is correct and avoids the /env.json 404.
  if (typeof window !== "undefined") return { ...DEFAULTS };

  return {
    N2P_API_URL:              process.env.N2P_API_URL              ?? DEFAULTS.N2P_API_URL,
    N2P_API_V2_URL:           process.env.N2P_API_V2_URL           ?? DEFAULTS.N2P_API_V2_URL,
    N2P_API_AUTH_URL:         process.env.N2P_API_AUTH_URL         ?? DEFAULTS.N2P_API_AUTH_URL,
    N2P_API_N2P_URL:          process.env.N2P_API_N2P_URL          ?? DEFAULTS.N2P_API_N2P_URL,
    N2P_API_PROFILE_SETTINGS: process.env.N2P_API_PROFILE_SETTINGS,
    N2P_HUDDLE_URL:           process.env.N2P_HUDDLE_URL,
    N2P_WALLBOARD_URL:        process.env.N2P_WALLBOARD_URL,
    N2P_AI_AGENT_URL:         process.env.N2P_AI_AGENT_URL,
    N2P_COACH_URL:            process.env.N2P_COACH_URL,
    N2P_MESSENGER_API_URL:    process.env.N2P_MESSENGER_API_URL,
    N2P_AUDIO_TRANSCODER_URL: process.env.N2P_AUDIO_TRANSCODER_URL,
  };
}
