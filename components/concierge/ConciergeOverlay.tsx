"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Sparkles, RotateCcw, Send, Loader2 } from "lucide-react";
import type Anthropic from "@anthropic-ai/sdk";
import { useConcierge, STAGE_ORDER, type ConciergeStage } from "@/contexts/ConciergeContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { getAccessToken } from "@/lib/auth";
import {
  researchWebsite,
  checkLicensing,
  applyConfiguration,
} from "@/lib/api/concierge-backend";
import { ProgressBar } from "./ProgressBar";
import { MessageBubble, type Message } from "./MessageBubble";
import { StageWidget } from "./StageWidgets";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApiMessage = Anthropic.MessageParam;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface ApiResponse {
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: ContentBlock[];
  error?: string;
}

// Tool badge labels
const TOOL_LABELS: Record<string, string> = {
  research_website:       "Researching your website",
  check_licensing:        "Checking license eligibility",
  apply_configuration:    "Building your configuration",
  advance_stage:          "Moving to next step",
  update_config:          "Saving your information",
  get_account_summary:    "Checking account capacity",
  get_next_extension:     "Getting next extension",
  create_schedule:        "Creating schedule",
  build_call_flow:        "Building call flow",
  search_support:         "Searching support articles",
};

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

// ── Main overlay ──────────────────────────────────────────────────────────────

export function ConciergeOverlay() {
  const {
    isOpen, isTransitioning, stage, config,
    close, reset, setTransitioning, advance, updateConfig,
  } = useConcierge();
  const { open: openAssistant } = useAssistant();

  // Display messages (what the user sees)
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  // API message history sent to Claude
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);

  const [input, setInput]         = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [lastStage, setLastStage] = useState<ConciergeStage | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // ── Reset when opened fresh ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && displayMessages.length === 0 && lastStage === null) {
      kickoffStage(stage, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Trigger AI intro whenever stage changes ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || stage === lastStage) return;
    setLastStage(stage);
    if (stage === "done") return; // handled by handleApplySuccess
    // Don't re-trigger on first mount (handled above)
    if (displayMessages.length > 0) {
      kickoffStage(stage, apiMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isOpen]);

  // ── Tool execution (client-side) ─────────────────────────────────────────────
  const executeTool = useCallback(
    async (
      name: string,
      toolInput: Record<string, unknown>
    ): Promise<unknown> => {
      // ── Concierge state-machine tools ──
      if (name === "advance_stage") {
        advance();
        return { success: true, message: toolInput.reason ?? "Advancing stage." };
      }

      if (name === "update_config") {
        const patch = toolInput.patch as Record<string, unknown>;
        if (patch && typeof patch === "object") {
          updateConfig(patch as Parameters<typeof updateConfig>[0]);
        }
        return { success: true };
      }

      if (name === "research_website") {
        const data = await researchWebsite(toolInput.url as string);
        return data;
      }

      if (name === "check_licensing") {
        const ok = await checkLicensing(toolInput.feature as string);
        return { eligible: ok, feature: toolInput.feature };
      }

      if (name === "apply_configuration") {
        if (!toolInput.confirm) return { success: false, error: "User did not confirm." };
        const result = await applyConfiguration(config);
        return result;
      }

      // ── net2phone account tools (via /api/n2p-tools) ──
      const token = getAccessToken();
      if (!token) return { error: "Not authenticated." };

      const res = await fetch("/api/n2p-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tool: name, input: toolInput }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Tool failed" };
      return json.data;
    },
    [advance, updateConfig, config]
  );

  // ── Core AI agentic loop ─────────────────────────────────────────────────────
  const driveLoop = useCallback(
    async (
      messages: ApiMessage[],
      activeBubbleId: string,
      currentStage: ConciergeStage,
      currentConfig: typeof config
    ): Promise<ApiMessage[]> => {
      while (true) {
        let response: ApiResponse;
        try {
          const res = await fetch("/api/concierge-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages,
              stage: currentStage,
              config: currentConfig,
            }),
          });
          response = await res.json();
        } catch {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: "Network error — please try again." }
                : m
            )
          );
          return messages;
        }

        if (response.error) {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: `Error: ${response.error}` }
                : m
            )
          );
          return messages;
        }

        const textContent = (response.content ?? [])
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

        if (response.stop_reason === "end_turn") {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: textContent || "…" }
                : m
            )
          );
          return [
            ...messages,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
          ];
        }

        if (response.stop_reason === "tool_use") {
          // Show any text the AI said before calling tools
          if (textContent) {
            setDisplayMessages((prev) =>
              prev.map((m) =>
                m.id === activeBubbleId ? { ...m, isTyping: false, text: textContent } : m
              )
            );
          }

          const toolUseBlocks = (response.content ?? []).filter(
            (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
              b.type === "tool_use"
          );

          const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

          for (const tool of toolUseBlocks) {
            const badgeId = newId();
            setDisplayMessages((prev) => [
              ...prev,
              { id: badgeId, role: "concierge" as const, text: `__tool__:${TOOL_LABELS[tool.name] ?? tool.name}` },
            ]);

            let result: unknown;
            try {
              result = await executeTool(tool.name, tool.input);
            } catch (e) {
              result = { error: e instanceof Error ? e.message : "Tool failed" };
            }

            // Mark tool badge as done
            setDisplayMessages((prev) =>
              prev.map((m) =>
                m.id === badgeId
                  ? { ...m, text: `__tool_done__:${TOOL_LABELS[tool.name] ?? tool.name}` }
                  : m
              )
            );

            // Special case: apply_configuration success → trigger transition
            if (tool.name === "apply_configuration") {
              const r = result as { success: boolean };
              if (r?.success) {
                handleApplySuccess();
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            });
          }

          // Start a new AI bubble for the follow-up response
          const nextBubbleId = newId();
          setDisplayMessages((prev) => {
            const cleaned = prev.filter(
              (m) => !(m.id === activeBubbleId && m.isTyping && !m.text)
            );
            return [...cleaned, { id: nextBubbleId, role: "concierge" as const, text: "", isTyping: true }];
          });

          messages = [
            ...messages,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
            { role: "user", content: toolResults as Anthropic.ToolResultBlockParam[] },
          ];
          activeBubbleId = nextBubbleId;
          continue;
        }

        break;
      }
      return messages;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executeTool]
  );

  // ── Send a message to the AI ─────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      text: string,
      showUserBubble = true,
      overrideMessages?: ApiMessage[],
      overrideStage?: ConciergeStage
    ) => {
      if (isRunning) return;
      setIsRunning(true);

      if (showUserBubble && text) {
        setDisplayMessages((prev) => [
          ...prev,
          { id: newId(), role: "user" as const, text },
        ]);
      }

      const bubbleId = newId();
      setDisplayMessages((prev) => [
        ...prev,
        { id: bubbleId, role: "concierge" as const, text: "", isTyping: true },
      ]);

      const base = overrideMessages ?? apiMessages;
      const nextMessages: ApiMessage[] = text
        ? [...base, { role: "user", content: text }]
        : base;

      const usedStage = overrideStage ?? stage;
      const finalMessages = await driveLoop(nextMessages, bubbleId, usedStage, config);
      setApiMessages(finalMessages);
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [isRunning, apiMessages, stage, config, driveLoop]
  );

  // ── Kick off AI intro message for a new stage ────────────────────────────────
  const kickoffStage = useCallback(
    (targetStage: ConciergeStage, existingMessages: ApiMessage[]) => {
      // System-initiated turn: send a silent trigger so the AI opens the stage
      const trigger = `[SYSTEM: The user has just entered the "${targetStage}" stage. Open this step naturally — introduce what you need and ask your first question. Do not mention internal stage names to the user.]`;
      sendMessage(trigger, false, existingMessages, targetStage);
    },
    [sendMessage]
  );

  // ── Handle successful apply → transition animation ───────────────────────────
  const handleApplySuccess = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setTransitioning(false);
      close();
      openAssistant();
    }, 700);
  }, [setTransitioning, close, openAssistant]);

  // ── User sends a message via the input box ───────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");
    sendMessage(text);
  };

  const handleReset = () => {
    reset();
    setDisplayMessages([]);
    setApiMessages([]);
    setLastStage(null);
    setInput("");
  };

  if (!isOpen) return null;

  const isDone = stage === "done";
  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-500 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden
      />

      {/* Card */}
      <div className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`
            w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col
            max-h-[90vh] pointer-events-auto
            transition-all duration-700 ease-in-out
            ${isTransitioning
              ? "translate-x-[calc(50vw_-_80px)] scale-[0.35] opacity-0"
              : "translate-x-0 scale-100 opacity-100"
            }
          `}
          style={{ transformOrigin: "center center" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e8eaed] bg-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Setup Concierge</h2>
                <p className="text-xs text-gray-400">
                  Step {Math.min(stageIdx + 1, 7)} of 7
                  {config.companyName ? ` · ${config.companyName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleReset} className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors" title="Start over">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={close} className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors" aria-label="Close">
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {!isDone && <ProgressBar currentStage={stage} />}

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Render messages — tool badges get special rendering */}
            <div className="flex flex-col px-4 py-4">
              {displayMessages.map((msg) => {
                // Tool badge
                if (msg.role === "concierge" && msg.text.startsWith("__tool")) {
                  const done = msg.text.startsWith("__tool_done__");
                  const label = msg.text.replace(/^__tool(?:_done)?__:/, "");
                  return (
                    <div key={msg.id} className="flex justify-center mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
                        done
                          ? "bg-green-50 border-green-100 text-green-700"
                          : "bg-blue-50 border-blue-100 text-blue-600"
                      }`}>
                        {done ? `✓ ${label}` : <><Loader2 className="w-3 h-3 animate-spin" />{label}…</>}
                      </span>
                    </div>
                  );
                }
                // Regular bubble
                return <MessageBubble key={msg.id} message={msg} />;
              })}

              {/* Stage widget — visible alongside the conversation */}
              {!isDone && (
                <div className="mt-1">
                  <StageWidget
                    onUserMessages={(msgs) => {
                      // When a widget submits data, inject it as a user message into the AI
                      const text = Array.isArray(msgs) ? msgs.join(" · ") : String(msgs);
                      sendMessage(text);
                    }}
                    onApply={handleApplySuccess}
                  />
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          {!isDone && (
            <div className="px-4 py-3 border-t border-[#e8eaed] bg-white rounded-b-2xl shrink-0 flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isRunning ? "Concierge is thinking…" : "Ask a question or type your answer…"}
                disabled={isRunning}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none disabled:opacity-50"
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isRunning}
                className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0] disabled:opacity-40 transition-colors shrink-0"
              >
                {isRunning
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          )}

          {/* Done footer */}
          {isDone && (
            <div className="px-5 py-4 border-t border-[#e8eaed] bg-[#f8f9fa] rounded-b-2xl shrink-0">
              <button
                onClick={() => { close(); openAssistant(); }}
                className="w-full py-2.5 text-sm font-medium bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] transition-colors"
              >
                Open Settings Sidekick →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
