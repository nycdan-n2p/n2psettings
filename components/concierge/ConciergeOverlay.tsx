"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, RotateCcw, Send, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge, STAGE_ORDER } from "@/contexts/ConciergeContext";
import { useConciergeAgent } from "@/hooks/useConciergeAgent";
import { ProgressBar } from "./ProgressBar";
import { MessageBubble } from "./MessageBubble";
import { StageWidget } from "./StageWidgets";

// ── Focus trap — keeps Tab/Shift-Tab inside the dialog ──────────────────────

function useFocusTrap(containerRef: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const focusable = () =>
      el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener("keydown", handler);
    const nodes = focusable();
    if (nodes.length) nodes[0].focus();

    return () => el.removeEventListener("keydown", handler);
  }, [containerRef, active]);
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function ConciergeOverlay() {
  const t = useTranslations("concierge");
  const tCommon = useTranslations("common");

  const {
    isOpen, isTransitioning, stage, config, close,
  } = useConcierge();

  const {
    messages: displayMessages,
    isRunning,
    widgetStage,
    sendMessage,
    resetAgent,
  } = useConciergeAgent();

  const [input, setInput] = useState("");
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const dialogRef    = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen && !isTransitioning);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Re-focus input when AI finishes
  useEffect(() => {
    if (!isRunning) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isRunning]);

  const handleReset = useCallback(() => {
    resetAgent();
    setInput("");
  }, [resetAgent]);

  const handleSend = useCallback(() => {
    const t = input.trim();
    if (t) {
      setInput("");
      sendMessage(t);
    }
  }, [input, sendMessage]);

  if (!isOpen) return null;

  const isDone   = stage === "done";
  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-500 motion-reduce:duration-0 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden="true"
        onClick={close}
      />

      {/* Dialog wrapper */}
      <div
        className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
      >
        <div
          ref={dialogRef}
          className={`
            w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col
            max-h-[90vh] pointer-events-auto
            transition-all duration-700 ease-in-out motion-reduce:duration-0
            ${isTransitioning
              ? "translate-x-[calc(50vw_-_80px)] scale-[0.35] opacity-0"
              : "translate-x-0 scale-100 opacity-100"
            }
          `}
          style={{ transformOrigin: "center center" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e8eaed] bg-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{t("title")}</h2>
                <p className="text-xs text-gray-400">
                  {t.rich("progressLabel")} {Math.min(stageIdx + 1, 7)} / 7
                  {config.companyName ? ` \u00b7 ${config.companyName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors"
                title={t("reset")}
                aria-label={t("reset")}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={close}
                className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors"
                aria-label={tCommon("close")}
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {!isDone && <ProgressBar currentStage={stage} />}

          {/* Messages */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            role="log"
            aria-live="polite"
            aria-label="Conversation"
          >
            <div className="flex flex-col px-4 py-4">
              {displayMessages.map((msg) => {
                if (msg.role === "concierge" && msg.text.startsWith("__tool")) {
                  const done  = msg.text.startsWith("__tool_done__");
                  const label = msg.text.replace(/^__tool(?:_done)?__:/, "");
                  return (
                    <div key={msg.id} className="flex justify-center mb-3" role="status">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
                        done
                          ? "bg-green-50 border-green-100 text-green-700"
                          : "bg-blue-50 border-blue-100 text-blue-600"
                      }`}>
                        {done
                          ? <>{"\u2713"} {label}</>
                          : <><Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}&hellip;</>
                        }
                      </span>
                    </div>
                  );
                }
                return <MessageBubble key={msg.id} message={msg} />;
              })}

              {/* Widget — hidden while AI is running */}
              {!isDone && !isRunning && (
                <div className="mt-1">
                  <StageWidget
                    currentStage={widgetStage}
                    onUserMessages={(msgs) => {
                      const text = Array.isArray(msgs) ? msgs.join(" \u00b7 ") : String(msgs);
                      sendMessage(text);
                    }}
                  />
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          {!isDone && (
            <div className="px-4 py-3 border-t border-[#e8eaed] bg-white rounded-b-2xl shrink-0 flex items-center gap-2">
              <label htmlFor="concierge-input" className="sr-only">
                {t("inputPlaceholder")}
              </label>
              <input
                id="concierge-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isRunning ? t("thinking") : t("inputPlaceholder")}
                disabled={isRunning}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none disabled:opacity-50"
                autoFocus
                aria-describedby={isRunning ? "concierge-status" : undefined}
              />
              {isRunning && (
                <span id="concierge-status" className="sr-only">
                  {t("thinking")}
                </span>
              )}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isRunning}
                className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0] disabled:opacity-40 transition-colors shrink-0"
                aria-label={t("send")}
              >
                {isRunning
                  ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  : <Send className="w-3.5 h-3.5" aria-hidden="true" />
                }
              </button>
            </div>
          )}

          {/* Done footer */}
          {isDone && (
            <div className="px-5 py-4 border-t border-[#e8eaed] bg-[#f8f9fa] rounded-b-2xl shrink-0">
              <button
                onClick={close}
                className="w-full py-2.5 text-sm font-medium bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] transition-colors"
              >
                {t("stages.done")} →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
