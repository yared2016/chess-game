// src/components/nav/mobile-bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Target, Trophy, GraduationCap, History } from "lucide-react";
import { cn } from "@/lib/ui";

const MOBILE_TABS = [
  { href: "/play", label: "Play", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Target },
  { href: "/tournaments", label: "Arenas", icon: Trophy },
  { href: "/university", label: "Campus", icon: GraduationCap },
  { href: "/history", label: "History", icon: History },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Hide mobile bottom nav during live game play so it doesn't obstruct chess piece drag/drop
  const isInsideLiveGame = pathname.startsWith("/game/");
  if (isInsideLiveGame) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-border/80 bg-card/95 backdrop-blur-xl px-2 py-1 shadow-lg"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 min-w-[56px] min-h-[48px]",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-colors",
                  isActive && "bg-primary/15 text-primary"
                )}
              >
                <Icon className={cn("size-5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
