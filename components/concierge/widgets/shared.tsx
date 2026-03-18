"use client";

import { RefreshCw, AlertCircle } from "lucide-react";
import { useConcierge, type ConciergeStage } from "@/contexts/ConciergeContext";

export function FixItButton({ targetStage, label = "Wait, let\u2019s fix that" }: { targetStage: ConciergeStage; label?: string }) {
  const { setStage } = useConcierge();
  return (
    <button
      onClick={() => setStage(targetStage)}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a73e8] transition-colors mt-3"
    >
      <RefreshCw className="w-3 h-3" aria-hidden="true" /> {label}
    </button>
  );
}

export function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-4 mb-4 bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl p-5 ${className}`} role="region">
      {children}
    </div>
  );
}

export function ValidationErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="space-y-1" role="alert">
      {errors.map((e, i) => (
        <p key={i} className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {e}
        </p>
      ))}
    </div>
  );
}
