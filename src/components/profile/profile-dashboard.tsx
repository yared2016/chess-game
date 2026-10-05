"use client";

import { useState } from "react";
import { usePreloadedQuery, type Preloaded, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileHeaderView, type ProfileSummary } from "./profile-header";
import { RatingSparkline } from "./rating-sparkline";
import { RecentGamesTable } from "./recent-games-table";
import { PlayerAchievements } from "./player-achievements";
import {
  Award,
  BookOpen,
  History,
  LayoutDashboard,
  ShieldCheck,
  Phone,
  Smartphone,
  Building2,
  Lock,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { ProfileOpenings } from "./profile-openings";
import { cn } from "@/lib/ui";
import Link from "next/link";

const DASHBOARD_TABS = [
  {
    id: "overview" as const,
    label: "Overview",
    desktopLabel: "Overview",
    subtitle: "Rating & Recent",
    icon: LayoutDashboard,
  },
  {
    id: "history" as const,
    label: "Match History",
    desktopLabel: "Match History",
    subtitle: "Replays & PGNs",
    icon: History,
  },
  {
    id: "openings" as const,
    label: "Analytics",
    desktopLabel: "Analytics & Openings",
    subtitle: "Openings & Prep",
    icon: BookOpen,
  },
  {
    id: "achievements" as const,
    label: "Achievements",
    desktopLabel: "Achievements & Badges",
    subtitle: "Trophies & Badges",
    icon: Award,
  },
] as const;

export function ProfileDashboard({
  preloaded,
  username,
}: {
  preloaded: Preloaded<typeof api.players.getByUsername>;
  username: string;
}) {
  const profile = usePreloadedQuery(preloaded);
  const me = useQuery(api.players.me);
  const isOwnProfile = Boolean(
    me && username && me.username.toLowerCase() === username.toLowerCase()
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "openings" | "achievements" | "kyc"
  >("overview");

  if (!profile) return null;

  const tabs = isOwnProfile
    ? [
        ...DASHBOARD_TABS,
        {
          id: "kyc" as const,
          label: "Payout & KYC",
          subtitle: "Private Banking",
          icon: ShieldCheck,
        },
      ]
    : DASHBOARD_TABS;

  return (
    <div className="space-y-6">
      <ProfileHeaderView profile={profile as ProfileSummary} />

      {/* Mobile Tab Navigation: Modern Segmented Dashboard Deck */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-card/60 border border-border/80 shadow-xs sm:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all relative overflow-hidden",
                tab.id === "kyc" && "col-span-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40 font-bold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98] border border-border/40"
              )}
            >
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border/50"
                )}
              >
                <Icon className="size-4 shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-xs font-bold leading-tight block truncate",
                    isActive ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-tight block truncate font-medium",
                    isActive ? "text-primary-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop Tab Navigation: Classic Horizontal Tabs */}
      <div className="hidden sm:flex items-center gap-2 border-b border-border/70 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {(tab as any).desktopLabel || tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <RatingSparkline username={username} />
          <RecentGamesTable username={username} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6">
          <RecentGamesTable username={username} />
        </div>
      )}

      {activeTab === "openings" && (
        <div className="space-y-6">
          <ProfileOpenings username={username} />
        </div>
      )}

      {activeTab === "achievements" && (
        <div className="space-y-6">
          <PlayerAchievements profile={profile as ProfileSummary} />
        </div>
      )}

      {activeTab === "kyc" && isOwnProfile && me && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-foreground">
                      Payout & KYC Settings
                    </h2>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Lock className="size-3" /> Strictly Private
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your verified banking and mobile money credentials used for secure prize withdrawals.
                  </p>
                </div>
              </div>
              <Link
                href="/complete-profile"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors shrink-0"
              >
                <span>Edit Payout Details</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-5">
              {/* Account Holder Legal Name */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Verified Legal Name
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                    <CheckCircle2 className="size-3" /> KYC Verified
                  </span>
                </div>
                <p className="font-semibold text-foreground text-base">
                  {me.fullName || me.displayName || me.username}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Withdrawal recipient name must strictly match this account holder.
                </p>
              </div>

              {/* Primary Phone */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Primary Phone Number
                  </span>
                  <Phone className="size-3.5 text-muted-foreground" />
                </div>
                <p className="font-mono font-semibold text-foreground text-base">
                  {me.phoneNumber || "Not configured"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Used for account security and SMS notifications.
                </p>
              </div>

              {/* Telebirr Withdrawal Account */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Telebirr Payout Account
                  </span>
                  <Smartphone className="size-3.5 text-primary" />
                </div>
                <p className="font-mono font-semibold text-foreground text-base">
                  {me.telebirrNumber || me.phoneNumber || "Not configured"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Auto-selected when requesting instant Telebirr wallet withdrawals.
                </p>
              </div>

              {/* Bank Account */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Bank Payout Account
                  </span>
                  <Building2 className="size-3.5 text-primary" />
                </div>
                {me.bankName && me.bankAccountNumber ? (
                  <div>
                    <p className="font-semibold text-foreground text-sm">{me.bankName}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">
                      Account: {me.bankAccountNumber}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No bank account linked yet.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Supports Commercial Bank of Ethiopia (CBE), Awash, Abyssinia, and more.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border/50 bg-background/50 p-3.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Lock className="size-4 shrink-0 text-muted-foreground" />
                <span>This financial and KYC information is strictly private and never visible to other players.</span>
              </span>
              <Link
                href="/wallet"
                className="text-primary hover:underline font-semibold shrink-0"
              >
                Go to Wallet &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
