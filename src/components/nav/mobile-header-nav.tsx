// src/components/nav/mobile-header-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Swords, Target, Trophy, GraduationCap, History, Wallet, Award } from "lucide-react";
import { cn } from "@/lib/ui";

const SIGNED_IN_NAV_ITEMS = [
  { href: "/play", label: "Play", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Target },
  { href: "/tournaments", label: "Arenas", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Award },
  { href: "/university", label: "Campus", icon: GraduationCap },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/history", label: "History", icon: History },
];

const GUEST_NAV_ITEMS = [
  { href: "/play", label: "Play", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Target },
  { href: "/tournaments", label: "Arenas", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Award },
  { href: "/university", label: "Campus", icon: GraduationCap },
];

export function MobileHeaderNav() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();

  // Hide mobile navigation during live game play so it doesn't obstruct chess piece drag/drop
  const isInsideLiveGame = pathname.startsWith("/game/");
  if (isInsideLiveGame) return null;

  const items = isLoaded && isSignedIn ? SIGNED_IN_NAV_ITEMS : GUEST_NAV_ITEMS;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar overscroll-x-contain px-3 py-1.5 border-t border-border/40 bg-background/95 backdrop-blur-md sm:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
              isActive
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className={cn("size-3.5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
