export interface EnvConfig {
  N2P_API_URL: string;
  N2P_API_V2_URL: string;
  N2P_API_AUTH_URL: string;
  N2P_API_PROFILE_SETTINGS?: string;
  N2P_HUDDLE_URL?: string;
  N2P_WALLBOARD_URL?: string;
  N2P_AI_AGENT_URL?: string;
  N2P_COACH_URL?: string;
  N2P_MESSENGER_API_URL?: string;
  N2P_AUDIO_TRANSCODER_URL?: string;
}

const defaultEnv: EnvConfig = {
  N2P_API_URL: "https://app.net2phone.com/",
  N2P_API_V2_URL: "https://api.n2p.io/v2",
  N2P_API_AUTH_URL: "https://auth.net2phone.com",
};

let cachedEnv: EnvConfig | null = null;

export async function loadEnv(): Promise<EnvConfig> {
  if (cachedEnv) return cachedEnv;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/env.json`);
    if (res.ok) {
      cachedEnv = { ...defaultEnv, ...(await res.json()) };
    } else {
      cachedEnv = defaultEnv;
    }
  } catch {
    cachedEnv = defaultEnv;
  }
  return cachedEnv ?? defaultEnv;
}

export function getEnv(): EnvConfig {
  return cachedEnv ?? defaultEnv;
}
