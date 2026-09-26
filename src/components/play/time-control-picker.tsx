"use client";

import { Clock, Zap, Flame, Shield, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/ui";

export interface TimeControlOption {
  key: string;
  label: string;
  sublabel: string;
  category: "bullet" | "blitz" | "rapid" | "classical" | "unlimited";
  icon: any;
}

export const POPULAR_TIME_CONTROLS: TimeControlOption[] = [
  { key: "blitz_3_0", label: "3 min", sublabel: "3+0 Blitz", category: "blitz", icon: Flame },
  { key: "blitz_3_2", label: "3 | 2", sublabel: "3+2 Blitz", category: "blitz", icon: Flame },
  { key: "blitz_5_0", label: "5 min", sublabel: "5+0 Blitz", category: "blitz", icon: Flame },
  { key: "blitz_5_3", label: "5 | 3", sublabel: "5+3 Blitz", category: "blitz", icon: Flame },
  { key: "rapid_10_0", label: "10 min", sublabel: "10+0 Rapid", category: "rapid", icon: Clock },
  { key: "rapid_15_10", label: "15 | 10", sublabel: "15+10 Rapid", category: "rapid", icon: Clock },
  { key: "bullet_1_0", label: "1 min", sublabel: "1+0 Bullet", category: "bullet", icon: Zap },
  { key: "bullet_2_1", label: "2 | 1", sublabel: "2+1 Bullet", category: "bullet", icon: Zap },
  { key: "unlimited", label: "Unlimited", sublabel: "Casual", category: "unlimited", icon: InfinityIcon },
];

interface TimeControlPickerProps {
  selectedKey?: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

export function TimeControlPicker({
  selectedKey = "blitz_5_0",
  onChange,
  disabled = false,
}: TimeControlPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
          Time Control
        </span>
        <span className="text-[11px] font-mono text-primary font-semibold">
          {POPULAR_TIME_CONTROLS.find((tc) => tc.key === selectedKey)?.sublabel ?? selectedKey}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
        {POPULAR_TIME_CONTROLS.map((tc) => {
          const isSelected = selectedKey === tc.key;
          const Icon = tc.icon;

          return (
            <button
              key={tc.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tc.key)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-150",
                isSelected
                  ? "bg-primary/15 border-primary/50 text-foreground shadow-xs ring-1 ring-primary/40 font-bold"
                  : "bg-card/50 hover:bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon
                  className={cn(
                    "size-3.5",
                    isSelected ? "text-primary" : "text-muted-foreground/70"
                  )}
                />
                <span className="text-xs font-bold leading-none">{tc.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground capitalize leading-tight">
                {tc.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
