"use client";

import { Search, SlidersHorizontal } from "lucide-react";

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  filterLabel?: string;
  children?: React.ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  onFilterClick,
  filterLabel = "Filter",
  children,
}: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
        />
      </div>
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="flex items-center gap-2 px-3 py-2 border border-[#dadce0] rounded-md text-sm hover:bg-[#f8f9fa]"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {filterLabel}
        </button>
      )}
      {children}
    </div>
  );
}
