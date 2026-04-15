"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

interface QuickLink {
  href: string;
  label: string;
}

interface ExpandableCardProps {
  title: string;
  description?: string;
  count?: number;
  defaultExpanded?: boolean;
  quickLinks: QuickLink[];
  children?: React.ReactNode;
}

export function ExpandableCard({
  title,
  description,
  count,
  defaultExpanded = false,
  quickLinks,
  children,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {count !== undefined && (
          <span className="text-sm font-medium text-[#1a73e8]">{count}</span>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[#dadce0]">
          <div className="flex flex-wrap gap-2 pt-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className="text-sm text-[#1a73e8] hover:underline font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>
          {children && <div className="mt-3">{children}</div>}
        </div>
      )}
    </div>
  );
}
