"use client";

import { Check } from "lucide-react";
import { STAGE_ORDER, STAGE_LABELS, type ConciergeStage } from "@/contexts/ConciergeContext";

interface ProgressBarProps {
  currentStage: ConciergeStage;
}

// Exclude "done" from the visible progress steps
const VISIBLE_STAGES = STAGE_ORDER.filter((s) => s !== "done");

export function ProgressBar({ currentStage }: ProgressBarProps) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-[#e8eaed] bg-[#f8f9fa] overflow-x-auto">
      {VISIBLE_STAGES.map((stage, i) => {
        const stageIdx = STAGE_ORDER.indexOf(stage);
        const isDone    = stageIdx < currentIdx;
        const isActive  = stage === currentStage;
        const isFuture  = stageIdx > currentIdx;

        return (
          <div key={stage} className="flex items-center shrink-0">
            {/* Step */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? "bg-[#1a73e8] text-white"
                    : isActive
                    ? "bg-[#1a73e8] text-white ring-4 ring-[#e8f0fe]"
                    : "bg-[#e8eaed] text-gray-400"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`mt-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? "text-[#1a73e8]" : isFuture ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>

            {/* Connector line */}
            {i < VISIBLE_STAGES.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mb-4 transition-colors ${
                  stageIdx < currentIdx ? "bg-[#1a73e8]" : "bg-[#e8eaed]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
