"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface SnackProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  onClose?: () => void;
  autoHideMs?: number;
}

export function Snack({ children, icon, className = "", onClose, autoHideMs = 5000 }: SnackProps) {
  useEffect(() => {
    if (!onClose || autoHideMs <= 0) return;
    const timer = window.setTimeout(() => onClose(), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [onClose, autoHideMs]);

  return (
    <div
      role="status"
      className={`fixed left-5 bottom-5 z-[120] inline-flex max-w-[420px] items-center gap-3 rounded-[22px] bg-[#111111] px-4 py-3 text-sm text-white ${className}`}
    >
      {icon ? (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-white">
          {icon}
        </span>
      ) : null}
      <span className="leading-5">{children}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
