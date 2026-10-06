"use client";

import React, { useState } from "react";
import { Search, X, Download, Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterTab {
  key: string;
  label: string;
  count?: number;
}

export interface DatePresetItem {
  key: string;
  label: string;
}

export interface FilterBarProps {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  onExportCsv?: () => void;
  exportLabel?: string;
  dateRangeLabel?: string;
  datePresets?: DatePresetItem[];
  activeDatePreset?: string;
  onDatePresetChange?: (preset: string) => void;
  className?: string;
}

export function FilterBar({
  tabs,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  onExportCsv,
  exportLabel = "Export CSV",
  dateRangeLabel,
  datePresets,
  activeDatePreset,
  onDatePresetChange,
  className,
}: FilterBarProps) {
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4",
        className
      )}
    >
      {/* =========================================================
          MOBILE VIEW: Clean Wrapped Pills (Zero horizontal scroll!)
          ========================================================= */}
      <div className="sm:hidden flex flex-wrap gap-1.5 w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5",
                isActive
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    isActive ? "text-primary-foreground/90 font-bold" : "opacity-75"
                  )}
                >
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================
          DESKTOP VIEW: Segmented Filter Bar
          ========================================================= */}
      <div className="hidden sm:flex flex-wrap items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/60">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5",
                isActive
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    isActive ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================
          RIGHT ACTIONS: Date Filter, Search, CSV Export
          ========================================================= */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
        {/* Optional Date Range Dropdown */}
        {(dateRangeLabel || datePresets) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted/50 transition-colors"
              aria-label="Filter by date range"
            >
              <Calendar className="size-3.5 text-primary" />
              <span className="truncate max-w-[140px] sm:max-w-none">
                {dateRangeLabel || "Date Range"}
              </span>
              {datePresets && (
                <ChevronDown
                  className={cn(
                    "size-3 text-muted-foreground transition-transform",
                    isDateDropdownOpen && "rotate-180"
                  )}
                />
              )}
            </button>

            {isDateDropdownOpen && datePresets && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
                  onClick={() => setIsDateDropdownOpen(false)}
                />
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                  <div className="space-y-0.5 text-xs font-medium">
                    {datePresets.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          onDatePresetChange?.(preset.key);
                          setIsDateDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full rounded-xl px-3 py-2 text-left text-xs transition-all",
                          activeDatePreset === preset.key
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-foreground hover:bg-muted/70"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search Bar with Clear 'X' */}
        <div className="relative flex-1 sm:w-64 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-border/80 bg-background pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              aria-label="Clear search query"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* CSV Export Button */}
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted/50 transition-colors shrink-0"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{exportLabel}</span>
            <span className="sm:hidden">Export</span>
          </button>
        )}
      </div>
    </div>
  );
}
