"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { getAccessToken } from "@/lib/auth";

// ── Stage definitions ────────────────────────────────────────────────────────

export type ConciergeStage =
  | "welcome_scrape"
  | "verification_holidays"
  | "porting"
  | "user_ingestion"
  | "architecture_hardware"
  | "licensing"
  | "final_blueprint"
  | "done";

export const STAGE_ORDER: ConciergeStage[] = [
  "welcome_scrape",
  "verification_holidays",
  "porting",
  "user_ingestion",
  "architecture_hardware",
  "licensing",
  "final_blueprint",
  "done",
];

export const STAGE_LABELS: Record<ConciergeStage, string> = {
  welcome_scrape:         "Welcome",
  verification_holidays:  "Verify & Holidays",
  porting:                "Porting",
  user_ingestion:         "Users",
  architecture_hardware:  "Architecture",
  licensing:              "Call Routing",
  final_blueprint:        "Review & Build",
  done:                   "Done",
};

// ── Data model ───────────────────────────────────────────────────────────────

export interface OnboardingUser {
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  macAddress?: string;
  hardphoneModel?: string;
}

export interface PortingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export interface MenuOption {
  key: string;
  destinationType: "department" | "ring_group" | "call_queue" | "voicemail" | "directory" | "user";
  destinationName: string;
}

export type QueueStrategy = "ring_all" | "round_robin" | "longest_idle" | "linear" | "fewest_calls";

export interface RoutingConfig {
  groupName: string;
  scheduleType: "24_7" | "business_hours" | "custom";
  customSchedule?: { name: string; weekDays: number[]; start: string; end: string };
  tiers: { userEmails: string[]; rings: number }[];
  ringStrategy: QueueStrategy;
  maxWaitTime: number;
  maxCapacity: number;
}

export interface WelcomeMenuConfig {
  enabled: boolean;
  greetingType: "tts" | "upload" | "none";
  greetingText: string;
  menuOptions: MenuOption[];
  allowExtensionDialing: boolean;
  playWaitMessage: boolean;
  allowBargingThrough: boolean;
  configured?: boolean;
}

export interface AfterHoursConfig {
  action: "voicemail" | "greeting" | "forward";
  forwardNumber?: string;
  greetingText?: string;
}

export interface OnboardingData {
  name: string;
  companyName: string;
  websiteUrl: string;
  scraped: {
    location: string;
    timezone: string;
    hours: Record<string, string>;
    phones: string[];
    address: string;
  };
  holidays: { date: string; name: string }[];
  portingQueue: {
    skipped: boolean;
    numbers: string[];
    providerName: string;
    accountNumber: string;
    providerBtn: string;
    pin: string;
    targetPortDate: string;
    contact: PortingAddress;
    onboardId?: number;
    signLink?: string;
    status?: string;
  };
  users: OnboardingUser[];
  departments: string[];
  routingType: "ring_groups" | "call_queues";
  licensingVerified: boolean;
  hasHardphones: boolean;
  phoneType: "hardphone" | "softphone" | "both";
  welcomeMenu: WelcomeMenuConfig;
  routingConfig: RoutingConfig;
  afterHours: AfterHoursConfig;
}

const EMPTY_PORTING_CONTACT: PortingAddress = {
  firstName: "", lastName: "", email: "", phone: "",
  companyName: "", address1: "", address2: "",
  city: "", state: "", zip: "",
};

export const EMPTY_CONFIG: OnboardingData = {
  name: "",
  companyName: "",
  websiteUrl: "",
  scraped: { location: "", timezone: "", hours: {}, phones: [], address: "" },
  holidays: [],
  portingQueue: {
    skipped: false,
    numbers: [],
    providerName: "",
    accountNumber: "",
    providerBtn: "",
    pin: "",
    targetPortDate: "",
    contact: EMPTY_PORTING_CONTACT,
  },
  users: [],
  departments: [],
  routingType: "ring_groups",
  licensingVerified: false,
  hasHardphones: false,
  phoneType: "softphone",
  welcomeMenu: { enabled: false, greetingType: "tts", greetingText: "", menuOptions: [], allowExtensionDialing: true, playWaitMessage: true, allowBargingThrough: true },
  routingConfig: {
    groupName: "",
    scheduleType: "24_7",
    tiers: [],
    ringStrategy: "ring_all",
    maxWaitTime: 300,
    maxCapacity: 10,
  },
  afterHours: { action: "voicemail" },
};

// ── State & Actions ──────────────────────────────────────────────────────────

interface ConciergeState {
  isOpen: boolean;
  isTransitioning: boolean;
  stage: ConciergeStage;
  config: OnboardingData;
}

type ConciergeAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "ADVANCE_STAGE" }
  | { type: "SET_STAGE"; stage: ConciergeStage }
  | { type: "UPDATE_CONFIG"; patch: Partial<OnboardingData> }
  | { type: "SET_TRANSITIONING"; value: boolean }
  | { type: "RESET" };

function reducer(state: ConciergeState, action: ConciergeAction): ConciergeState {
  switch (action.type) {
    case "OPEN":
      return { ...state, isOpen: true };
    case "CLOSE":
      return { ...state, isOpen: false, isTransitioning: false };
    case "ADVANCE_STAGE": {
      const idx = STAGE_ORDER.indexOf(state.stage);
      const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
      return { ...state, stage: next };
    }
    case "SET_STAGE":
      return { ...state, stage: action.stage };
    case "UPDATE_CONFIG":
      return { ...state, config: { ...state.config, ...action.patch } };
    case "SET_TRANSITIONING":
      return { ...state, isTransitioning: action.value };
    case "RESET":
      return { isOpen: false, isTransitioning: false, stage: "welcome_scrape", config: EMPTY_CONFIG };
    default:
      return state;
  }
}

const STORAGE_KEY = "n2p_concierge_state";

function loadSaved(): Partial<ConciergeState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ConciergeState>;
  } catch {
    return {};
  }
}

const initialState: ConciergeState = (() => {
  const saved = loadSaved();
  return {
    isOpen: false,
    isTransitioning: false,
    stage: saved.stage ?? "welcome_scrape",
    config: { ...EMPTY_CONFIG, ...(saved.config ?? {}) },
  };
})();

// ── Context ──────────────────────────────────────────────────────────────────

interface ConciergeContextValue {
  isOpen: boolean;
  isTransitioning: boolean;
  stage: ConciergeStage;
  config: OnboardingData;
  stageIndex: number;
  open: () => void;
  close: () => void;
  advance: () => void;
  setStage: (s: ConciergeStage) => void;
  updateConfig: (patch: Partial<OnboardingData>) => void;
  setTransitioning: (v: boolean) => void;
  reset: () => void;
}

const ConciergeContext = createContext<ConciergeContextValue | null>(null);

export function ConciergeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const serverSyncedRef = useRef(false);

  // ── localStorage persistence ────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ stage: state.stage, config: state.config })
      );
    } catch {
      // Storage might be unavailable
    }
  }, [state.stage, state.config]);

  // ── Server-side persistence: load on mount ──────────────────────────────
  useEffect(() => {
    if (serverSyncedRef.current) return;
    serverSyncedRef.current = true;

    const token = getAccessToken();
    if (!token) return;

    const localData = loadSaved();
    if (localData.stage && localData.stage !== "welcome_scrape") return;

    fetch("/api/onboarding-state", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.stage || data.stage === "welcome_scrape") return;
        dispatch({ type: "SET_STAGE", stage: data.stage });
        if (data.config) {
          dispatch({ type: "UPDATE_CONFIG", patch: data.config });
        }
      })
      .catch(() => {});
  }, []);

  // ── Server-side persistence: debounced save on change ───────────────────
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const timer = setTimeout(() => {
      fetch("/api/onboarding-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: state.stage, config: state.config }),
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.stage, state.config]);

  const open              = useCallback(() => dispatch({ type: "OPEN" }), []);
  const close             = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const advance           = useCallback(() => dispatch({ type: "ADVANCE_STAGE" }), []);
  const setStage          = useCallback((s: ConciergeStage) => dispatch({ type: "SET_STAGE", stage: s }), []);
  const updateConfig      = useCallback((patch: Partial<OnboardingData>) => dispatch({ type: "UPDATE_CONFIG", patch }), []);
  const setTransitioning  = useCallback((v: boolean) => dispatch({ type: "SET_TRANSITIONING", value: v }), []);
  const reset             = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    const token = getAccessToken();
    if (token) {
      fetch("/api/onboarding-state", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    dispatch({ type: "RESET" });
  }, []);

  const stageIndex = STAGE_ORDER.indexOf(state.stage);

  return (
    <ConciergeContext.Provider
      value={{
        isOpen:           state.isOpen,
        isTransitioning:  state.isTransitioning,
        stage:            state.stage,
        config:           state.config,
        stageIndex,
        open,
        close,
        advance,
        setStage,
        updateConfig,
        setTransitioning,
        reset,
      }}
    >
      {children}
    </ConciergeContext.Provider>
  );
}

export function useConcierge(): ConciergeContextValue {
  const ctx = useContext(ConciergeContext);
  if (!ctx) throw new Error("useConcierge must be used within ConciergeProvider");
  return ctx;
}
