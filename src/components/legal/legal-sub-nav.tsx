"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, FileText, Lock, Coins } from "lucide-react";
import { cn } from "@/lib/ui";

const LEGAL_NAV = [
  { href: "/legal", label: "Overview", icon: ShieldCheck, exact: true },
  { href: "/legal/terms", label: "Terms of Service", icon: FileText },
  { href: "/legal/privacy", label: "Privacy Policy", icon: Lock },
  { href: "/legal/payments", label: "Payments & Tariffs", icon: Coins },
];

export function LegalSubNav() {
  const pathname = usePathname();

  return (
    <div
      data-slot="legal-sub-nav"
      className="sticky top-14 z-30 w-full border-b border-border/70 bg-background/85 backdrop-blur-md transition-colors"
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: subtle section title / breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 select-none">
          <ShieldCheck className="size-4 text-primary" />
          <span>Legal Center</span>
        </div>

        {/* Navigation tabs */}
        <nav
          aria-label="Legal Sections"
          className="flex flex-1 sm:flex-initial items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1"
        >
          {LEGAL_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 shrink-0 select-none",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                )}
              >
                <Icon className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
