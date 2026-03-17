"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

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
  licensing:              "Licensing",
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
    numbers: string[];
    companyName: string;
    address: string;
  };
  users: OnboardingUser[];
  departments: string[];
  routingType: "ring_groups" | "call_queues";
  licensingVerified: boolean;
  hasHardphones: boolean;
}

export const EMPTY_CONFIG: OnboardingData = {
  name: "",
  companyName: "",
  websiteUrl: "",
  scraped: { location: "", timezone: "", hours: {}, phones: [], address: "" },
  holidays: [],
  portingQueue: { numbers: [], companyName: "", address: "" },
  users: [],
  departments: [],
  routingType: "ring_groups",
  licensingVerified: false,
  hasHardphones: false,
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

  // Persist stage + config (not isOpen / isTransitioning) on every change
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

  const open              = useCallback(() => dispatch({ type: "OPEN" }), []);
  const close             = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const advance           = useCallback(() => dispatch({ type: "ADVANCE_STAGE" }), []);
  const setStage          = useCallback((s: ConciergeStage) => dispatch({ type: "SET_STAGE", stage: s }), []);
  const updateConfig      = useCallback((patch: Partial<OnboardingData>) => dispatch({ type: "UPDATE_CONFIG", patch }), []);
  const setTransitioning  = useCallback((v: boolean) => dispatch({ type: "SET_TRANSITIONING", value: v }), []);
  const reset             = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
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
