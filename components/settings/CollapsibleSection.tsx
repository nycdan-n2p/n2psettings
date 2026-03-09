"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white overflow-hidden mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-4 px-4 py-4 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            {subtitle && (
              <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[#dadce0]">
          <div className="pl-8 pt-4 space-y-4">{children}</div>
        </div>
      )}
    </div>
  );
}
