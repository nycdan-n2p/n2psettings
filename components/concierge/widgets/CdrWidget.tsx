"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, AlertCircle, Users, Phone, SkipForward, ShieldCheck, CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge, type QueueStrategy, type MenuOption, type OnboardingUser } from "@/contexts/ConciergeContext";
import { getAccessToken } from "@/lib/auth";
import { CardShell } from "./shared";


type CdrStep = "ask" | "upload" | "analyzing" | "review";

interface CdrAnalysisResult {
  agents: { name: string; extension: string }[];
  inboundNumbers: string[];
  queues: string[];
  insights: string[];
  recommendations: {
    routingType: "ring_groups" | "call_queues";
    strategy: QueueStrategy;
    afterHoursAction: "voicemail" | "greeting";
    welcomeMenuEnabled: boolean;
    suggestedGreeting: string;
    menuOptions: MenuOption[];
  };
  summary: string;
}

export function CdrWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const t = useTranslations("concierge");
  const { config, updateConfig } = useConcierge();
  const [step, setStep] = useState<CdrStep>(() => {
    if (config.cdrAnalysis?.analyzed) return "review";
    return "ask";
  });
  const [analysis, setAnalysis] = useState<CdrAnalysisResult | null>(() =>
    config.cdrAnalysis?.analyzed
      ? {
          agents: config.cdrAnalysis.agents,
          inboundNumbers: config.cdrAnalysis.inboundNumbers,
          queues: config.cdrAnalysis.queues,
          insights: config.cdrAnalysis.insights,
          recommendations: config.cdrAnalysis.recommendations,
          summary: "",
        }
      : null
  );
  const [analysisError, setAnalysisError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleSkip = () => {
    updateConfig({ cdrAnalysis: { ...config.cdrAnalysis, skipped: true } });
    onMessages(["[cdr-skipped] I don't have a CDR right now, let's continue manually."]);
  };

  const analyzeFile = async (file: File) => {
    setStep("analyzing");
    setAnalysisError("");
    const text = await file.text();
    try {
      const token = getAccessToken();
      const res = await fetch("/api/analyze-cdr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ csvText: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      const result = json as CdrAnalysisResult;
      setAnalysis(result);
      updateConfig({
        cdrAnalysis: {
          ...config.cdrAnalysis,
          analyzed: true,
          agents: result.agents ?? [],
          inboundNumbers: result.inboundNumbers ?? [],
          queues: result.queues ?? [],
          insights: result.insights ?? [],
          recommendations: result.recommendations ?? config.cdrAnalysis.recommendations,
        },
      });
      setStep("review");
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
      setStep("upload");
    }
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setAnalysisError("Please upload a CSV file.");
      return;
    }
    analyzeFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0] ?? null);
  };

  const handleApprove = () => {
    if (!analysis) return;
    // Pre-populate users from CDR agents
    const newUsers = analysis.agents
      .filter((a) => a.name && a.name !== "None")
      .map((a) => {
        const parts = a.name.trim().split(/\s+/);
        const firstName = parts[0] ?? a.name;
        const lastName = parts.slice(1).join(" ");
        return { firstName, lastName, extension: a.extension } as OnboardingUser;
      });

    // Pre-populate departments from queues
    const newDepts = analysis.queues
      .filter((q) => q && q !== "None")
      .map((q) => q.replace(/_/g, " "));

    // Pre-populate routing from recommendations
    const rec = analysis.recommendations;
    const updates: Partial<typeof config> = {
      cdrAnalysis: { ...config.cdrAnalysis, approvedRecommendation: true },
    };
    if (newUsers.length > 0) updates.users = newUsers;
    if (newDepts.length > 0) updates.departments = newDepts;
    if (rec.routingType) updates.routingType = rec.routingType;
    if (rec.routingType) {
      const VALID_STRATEGIES: QueueStrategy[] = ["ring_all", "round_robin", "longest_idle", "linear", "fewest_calls"];
      // Normalize CDR-returned strategy (Claude may use dashes or different casing)
      const rawStrategy = String(rec.strategy ?? "").toLowerCase().replace(/-/g, "_");
      const safeStrategy: QueueStrategy = (VALID_STRATEGIES.includes(rawStrategy as QueueStrategy) ? rawStrategy : "ring_all") as QueueStrategy;
      updates.routingConfig = {
        ...config.routingConfig,
        ringStrategy: safeStrategy,
        scheduleType: "24_7",
      };
    }
    if (rec.welcomeMenuEnabled) {
      updates.welcomeMenu = {
        ...(config.welcomeMenu ?? {}),
        enabled: true,
        greetingType: "tts" as const,
        greetingText: rec.suggestedGreeting,
        menuOptions: rec.menuOptions ?? [],
        allowExtensionDialing: false,
        playWaitMessage: false,
        allowBargingThrough: false,
      };
    }
    if (rec.afterHoursAction) {
      updates.afterHours = { action: rec.afterHoursAction } as typeof config.afterHours;
    }
    if (analysis.inboundNumbers.length > 0) {
      updates.portingQueue = {
        ...config.portingQueue,
        numbers: analysis.inboundNumbers,
        numberIntent: "port",
        skipped: false,
      };
    }
    updateConfig(updates);
    const summaryText = analysis.summary || `CDR analysis complete: found ${analysis.agents.length} agent(s), ${analysis.inboundNumbers.length} inbound number(s), ${analysis.queues.length} queue(s).`;
    onMessages([`[cdr-approved] ${summaryText}`]);
  };

  const handleManual = () => {
    onMessages(["[cdr-manual] I reviewed the analysis but want to fill in the details manually."]);
  };

  if (step === "ask") {
    return (
      <CardShell>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-[#e8f0fe] rounded-lg">
            <Upload className="w-4 h-4 text-[#1a73e8]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#202124]">{t("cdr.askTitle")}</p>
            <p className="text-xs text-gray-500">{t("cdr.askSubtitle")}</p>
          </div>
        </div>
        <p className="text-sm text-[#3c4043] mb-1">
          {t("cdr.askBodyMain")}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          {t("cdr.askBodySub")}
        </p>
        <div className="space-y-2">
          <button
            onClick={() => setStep("upload")}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] transition-colors"
          >
            <Upload className="w-4 h-4" aria-hidden="true" /> {t("cdr.uploadNow")}
          </button>
          <button
            onClick={handleSkip}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-[#e8eaed] text-[#3c4043] rounded-xl hover:bg-[#f1f3f4] transition-colors"
          >
            <SkipForward className="w-4 h-4" aria-hidden="true" /> {t("cdr.skipButton")}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          {t("cdr.rerunNote")}
        </p>
      </CardShell>
    );
  }

  if (step === "upload") {
    return (
      <CardShell>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-[#e8f0fe] rounded-lg">
            <Upload className="w-4 h-4 text-[#1a73e8]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[#202124]">{t("cdr.uploadTitle")}</p>
        </div>
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#f8f9ff]"
          }`}
          role="button"
          aria-label={t("cdr.uploadTitle")}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <Upload className="w-8 h-8 text-[#1a73e8]" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#202124]">{t("cdr.dropZoneText")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("cdr.dropZoneHint")}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            aria-hidden="true"
          />
        </div>
        {analysisError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {analysisError}
          </p>
        )}
        <button
          onClick={handleSkip}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-[#1a73e8] transition-colors"
        >
          <SkipForward className="w-3.5 h-3.5" aria-hidden="true" /> {t("cdr.skipButton")}
        </button>
      </CardShell>
    );
  }

  if (step === "analyzing") {
    return (
      <CardShell>
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-semibold text-[#202124]">{t("cdr.analyzingTitle")}</p>
            <p className="text-xs text-gray-500 mt-1">{t("cdr.analyzingDescription")}</p>
          </div>
        </div>
      </CardShell>
    );
  }

  // review step
  if (!analysis) return null;
  const rec = analysis.recommendations;

  return (
    <CardShell>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-[#e6f4ea] rounded-lg">
          <ShieldCheck className="w-4 h-4 text-[#34a853]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#202124]">{t("cdr.reviewTitle")}</p>
          <p className="text-xs text-gray-500">{analysis.agents.length} {t("cdr.agents").toLowerCase()} &middot; {analysis.inboundNumbers.length} {t("cdr.numbers").toLowerCase()} &middot; {analysis.queues.length} {t("cdr.queues").toLowerCase()}</p>
        </div>
      </div>

      {/* Agents */}
      {analysis.agents.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{t("cdr.agents")}</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.agents.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e8f0fe] rounded-full text-xs text-[#1a73e8] font-medium">
                <Users className="w-3 h-3" aria-hidden="true" /> {a.name} &middot; {a.extension}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Numbers */}
      {analysis.inboundNumbers.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{t("cdr.numbers")}</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.inboundNumbers.map((n, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#fce8b2] rounded-full text-xs text-[#b06000] font-medium">
                <Phone className="w-3 h-3" aria-hidden="true" /> {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{t("cdr.insights")}</p>
          <ul className="space-y-1">
            {analysis.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[#3c4043]">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#fbbc04] shrink-0" aria-hidden="true" />
                {ins}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div className="mb-4 bg-[#e6f4ea] rounded-xl p-3 border border-[#ceead6]">
        <p className="text-xs font-semibold text-[#34a853] mb-1">{t("cdr.recommendations")}</p>
        <p className="text-xs text-[#3c4043]">
          <strong>{t("cdr.routingType")}:</strong> {rec.routingType === "call_queues" ? "Call Queues" : "Ring Groups"} &nbsp;|&nbsp;
          <strong>{t("cdr.strategy")}:</strong> {rec.strategy.replace(/_/g, " ")} &nbsp;|&nbsp;
          <strong>{t("cdr.afterHours")}:</strong> {rec.afterHoursAction}
        </p>
        {rec.welcomeMenuEnabled && rec.suggestedGreeting && (
          <p className="text-xs text-[#3c4043] mt-1">
            <strong>{t("cdr.welcomeMenu")}:</strong> &ldquo;{rec.suggestedGreeting.slice(0, 80)}{rec.suggestedGreeting.length > 80 ? "\u2026" : ""}&rdquo;
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={handleApprove}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#34a853] text-white rounded-xl hover:bg-[#2d9149] transition-colors"
        >
          <CheckSquare className="w-4 h-4" aria-hidden="true" /> {t("cdr.approveButton")}
        </button>
        <button
          onClick={handleManual}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-[#e8eaed] text-[#3c4043] rounded-xl hover:bg-[#f1f3f4] transition-colors"
        >
          {t("cdr.continueManually")}
        </button>
      </div>
    </CardShell>
  );
}

