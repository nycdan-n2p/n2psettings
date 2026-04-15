"use client";

import type { ReactNode } from "react";

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
};

type SegmentedTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  equalWidth?: boolean;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
  equalWidth = true,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`inline-flex min-w-max h-[38px] items-center gap-[2px] p-[2px] rounded-[var(--control-radius)] bg-[#F9F9FB] ${className}`}
      style={{ height: 38, minHeight: 38, maxHeight: 38, padding: 2 }}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`!h-[34px] px-5 text-sm font-medium rounded-[10px] transition-all whitespace-nowrap ${equalWidth ? "flex-1" : ""} ${
              active
                ? "bg-white text-gray-900"
                : "text-gray-600 hover:text-gray-800"
            }`}
            style={{ height: 34, minHeight: 34, maxHeight: 34 }}
          >
            <span className={`inline-flex w-full items-center gap-2 whitespace-nowrap ${option.badge ? "justify-between" : "justify-center"}`}>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                <span>{option.label}</span>
              </span>
              {option.badge ? <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center">{option.badge}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
