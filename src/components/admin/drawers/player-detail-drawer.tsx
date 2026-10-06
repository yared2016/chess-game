"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  User,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  History,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Ban,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Coins,
  CreditCard,
  Receipt,
  FileText,
  AlertCircle,
  ExternalLink,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DetailDrawer, StatusBadge, ConfirmDialog } from "@/components/admin/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/ui";
import { cn } from "@/lib/utils";

export interface PlayerDetailDrawerProps {
  playerId: Id<"players"> | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayerUpdated?: () => void;
  initialTab?: DrawerTab;
}

export type DrawerTab = "profile" | "wallet" | "fairplay" | "audit";

export function PlayerDetailDrawer({
  playerId,
  isOpen,
  onClose,
  onPlayerUpdated,
  initialTab = "profile",
}: PlayerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Restriction local states
  const [depositsRestricted, setDepositsRestricted] = useState(false);
  const [stakingRestricted, setStakingRestricted] = useState(false);
  const [withdrawalsRestricted, setWithdrawalsRestricted] = useState(false);
  const [freezeEntireWallet, setFreezeEntireWallet] = useState(false);
  const [auditReason, setAuditReason] = useState("");

  // Confirmation dialogs
  const [isConfirmRestrictionsOpen, setIsConfirmRestrictionsOpen] = useState(false);
  const [isSavingRestrictions, setIsSavingRestrictions] = useState(false);

  const [isWarnDialogOpen, setIsWarnDialogOpen] = useState(false);
  const [isWarningPlayer, setIsWarningPlayer] = useState(false);

  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isBanningPlayer, setIsBanningPlayer] = useState(false);

  // Queries & Mutations
  const playerDetails = useQuery(
    api.admin.getPlayerDetails,
    playerId && isOpen ? { playerId } : "skip"
  );

  const setRestrictionsMutation = useMutation(
    api.admin.finance.setPlayerWalletRestrictions
  );
  const takeFairPlayActionMutation = useMutation(
    api.fairPlay.takeFairPlayAction
  );

  // Synchronize restriction state when wallet data arrives
  useEffect(() => {
    if (playerDetails?.wallet) {
      setDepositsRestricted(Boolean(playerDetails.wallet.depositsRestricted));
      setStakingRestricted(Boolean(playerDetails.wallet.stakingRestricted));
      setWithdrawalsRestricted(Boolean(playerDetails.wallet.withdrawalsRestricted));
      setFreezeEntireWallet(playerDetails.wallet.status === "frozen");
    }
  }, [playerDetails?.wallet]);

  // Reset tab on drawer open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAuditReason("");
    }
  }, [isOpen, playerId, initialTab]);

  const copyToClipboard = (text: string, label: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveRestrictions = async (reasonFromDialog: string) => {
    if (!playerId) return;
    const finalReason = reasonFromDialog.trim() || auditReason.trim();
    if (!finalReason) {
      toast.error("An audit reason is required to modify restrictions.");
      return;
    }

    setIsSavingRestrictions(true);
    try {
      await setRestrictionsMutation({
        targetUserId: playerId,
        depositsRestricted,
        stakingRestricted,
        withdrawalsRestricted,
        freezeEntireWallet,
        reason: finalReason,
      });

      toast.success("Wallet restrictions updated successfully.");
      setAuditReason("");
      setIsConfirmRestrictionsOpen(false);
      onPlayerUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update wallet restrictions.");
    } finally {
      setIsSavingRestrictions(false);
    }
  };

  const handleWarnPlayer = async (reason: string) => {
    if (!playerId) return;
    setIsWarningPlayer(true);
    try {
      await takeFairPlayActionMutation({
        action: "warn",
        targetPlayerId: playerId,
        warningMessage: reason,
        adminNotes: reason,
      });
      toast.success("Official Fair Play warning issued.");
      setIsWarnDialogOpen(false);
      onPlayerUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue warning.");
    } finally {
      setIsWarningPlayer(false);
    }
  };

  const handleBanPlayer = async (reason: string) => {
    if (!playerId) return;
    setIsBanningPlayer(true);
    try {
      await takeFairPlayActionMutation({
        action: "ban",
        targetPlayerId: playerId,
        adminNotes: reason,
      });
      toast.success("Player account banned and wallet frozen.");
      setIsBanDialogOpen(false);
      onPlayerUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to ban player.");
    } finally {
      setIsBanningPlayer(false);
    }
  };

  if (!playerDetails) {
    return (
      <DetailDrawer
        isOpen={isOpen}
        onClose={onClose}
        title="Player Profile"
        subtitle="Loading player..."
        className="sm:max-w-2xl"
      >
        <div className="py-20 text-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-muted-foreground">
            Retrieving player ledger and profile data...
          </p>
        </div>
      </DetailDrawer>
    );
  }

  const { profile, wallet, fairPlay, auditHistory = [] } = playerDetails;

  const drawerTitle = profile.displayName || profile.username;
  const drawerSubtitle = `@${profile.username}`;

  return (
    <>
      <DetailDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        className="sm:max-w-2xl"
      >
        <div className="space-y-6">
            {/* Tab Navigation Header */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/70 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap",
                  activeTab === "profile"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <User className="size-3.5" />
                <span>Profile & Account</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("wallet")}
                className={cn(
                  "flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap",
                  activeTab === "wallet"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Wallet className="size-3.5" />
                <span>Wallet & Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("fairplay")}
                className={cn(
                  "flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap",
                  activeTab === "fairplay"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <ShieldAlert className="size-3.5" />
                <span>Fair Play</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={cn(
                  "flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap",
                  activeTab === "audit"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <History className="size-3.5" />
                <span>Admin Audit History</span>
              </button>
            </div>

            {/* TAB 1: Profile & Account */}
            {activeTab === "profile" && (
              <div className="space-y-5">
                {/* Profile Header Summary */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <Avatar className="size-14 border-2 border-border shadow-xs">
                        <AvatarImage src={profile.avatar} alt={profile.username} />
                        <AvatarFallback className="text-sm font-bold bg-muted">
                          {initials(profile.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-foreground">
                            {profile.displayName || profile.username}
                          </h3>
                          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            Verified Player
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          @{profile.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={profile.accountStatus} size="md" />
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                          profile.isOnline
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted/70 text-muted-foreground border-border/70"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            profile.isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                          )}
                        />
                        <span>{profile.isOnline ? "Online" : "Offline"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Identity & Account Details Table */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-3.5 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Account Identity Details
                  </h4>

                  <div className="divide-y divide-border/50 text-xs">
                    {/* Email */}
                    <div className="py-2.5 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Email Address:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate max-w-[220px]">
                          {profile.email || "No email on file"}
                        </span>
                        {profile.email && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(profile.email, "Email", "email")
                            }
                            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Copy email"
                          >
                            {copiedKey === "email" ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Clerk ID */}
                    <div className="py-2.5 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Clerk Auth ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-foreground truncate max-w-[200px]">
                          {profile.clerkId}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(profile.clerkId, "Clerk ID", "clerk")
                          }
                          className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Copy Clerk ID"
                        >
                          {copiedKey === "clerk" ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Member Since */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-muted-foreground">Member Since:</span>
                      <span className="font-medium text-foreground">
                        {new Date(profile.memberSince).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Last Active */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-muted-foreground">Last Active:</span>
                      <span className="font-medium text-foreground">
                        {profile.lastSeen
                          ? new Date(profile.lastSeen).toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Never"}
                      </span>
                    </div>

                    {/* Account Status */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-muted-foreground">Account Status:</span>
                      <StatusBadge status={profile.accountStatus} size="sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Wallet & Ledger */}
            {activeTab === "wallet" && (
              <div className="space-y-6">
                {/* Key Balance Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Authoritative Ledger Balances
                    </h4>
                    <StatusBadge status={wallet?.status ?? "active"} size="sm" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Available Balance */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Available Balance
                        </span>
                        <Wallet className="size-4 text-emerald-500" />
                      </div>
                      <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {((wallet?.availableBalance ?? 0) / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        <span className="text-xs font-sans font-semibold">ETB</span>
                      </p>
                    </div>

                    {/* Locked Balance */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Locked Balance
                        </span>
                        <Lock className="size-4 text-amber-500" />
                      </div>
                      <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                        {((wallet?.lockedBalance ?? 0) / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        <span className="text-xs font-sans font-semibold">ETB</span>
                      </p>
                    </div>

                    {/* Total Deposited */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Total Deposited
                        </span>
                        <ArrowDownLeft className="size-4 text-primary" />
                      </div>
                      <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                        {((wallet?.totalDeposited ?? 0) / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        <span className="text-xs font-sans font-semibold">ETB</span>
                      </p>
                    </div>

                    {/* Total Withdrawn */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Total Withdrawn
                        </span>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </div>
                      <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                        {((wallet?.totalWithdrawn ?? 0) / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        <span className="text-xs font-sans font-semibold">ETB</span>
                      </p>
                    </div>

                    {/* Net Gaming Profit */}
                    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs sm:col-span-2 lg:col-span-2">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Net Gaming Profit
                        </span>
                        <TrendingUp className="size-4 text-purple-400" />
                      </div>
                      <p
                        className={cn(
                          "text-xl font-bold font-mono tabular-nums",
                          (wallet?.gamingProfit ?? 0) >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {(wallet?.gamingProfit ?? 0) >= 0 ? "+" : ""}
                        {((wallet?.gamingProfit ?? 0) / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        <span className="text-xs font-sans font-semibold">ETB</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Targeted Wallet Security & Freeze Controls */}
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-amber-500/20 pb-3">
                    <Sliders className="size-4 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Targeted Wallet Security & Freeze Controls
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Authoritative administrative switches with required audit justification
                      </p>
                    </div>
                  </div>

                  {/* Toggle Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Deposits Toggle */}
                    <div className="rounded-2xl border border-border/70 bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">Deposits</p>
                        <p className="text-[10px] text-muted-foreground">
                          {depositsRestricted ? "Restricted" : "Enabled"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDepositsRestricted(!depositsRestricted)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all",
                          depositsRestricted
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}
                      >
                        {depositsRestricted ? "Restricted" : "Enabled"}
                      </button>
                    </div>

                    {/* Staking Toggle */}
                    <div className="rounded-2xl border border-border/70 bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">Staking</p>
                        <p className="text-[10px] text-muted-foreground">
                          {stakingRestricted ? "Restricted" : "Enabled"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStakingRestricted(!stakingRestricted)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all",
                          stakingRestricted
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}
                      >
                        {stakingRestricted ? "Restricted" : "Enabled"}
                      </button>
                    </div>

                    {/* Withdrawals Toggle */}
                    <div className="rounded-2xl border border-border/70 bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">Withdrawals</p>
                        <p className="text-[10px] text-muted-foreground">
                          {withdrawalsRestricted ? "Restricted" : "Enabled"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWithdrawalsRestricted(!withdrawalsRestricted)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all",
                          withdrawalsRestricted
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}
                      >
                        {withdrawalsRestricted ? "Restricted" : "Enabled"}
                      </button>
                    </div>

                    {/* Freeze Entire Wallet Toggle */}
                    <div className="rounded-2xl border border-border/70 bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">Freeze Entire Wallet</p>
                        <p className="text-[10px] text-muted-foreground">
                          {freezeEntireWallet ? "Frozen" : "Active"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFreezeEntireWallet(!freezeEntireWallet)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all",
                          freezeEntireWallet
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-muted text-foreground border border-border/70"
                        )}
                      >
                        {freezeEntireWallet ? "Frozen" : "Active"}
                      </button>
                    </div>
                  </div>

                  {/* Audit Reason Input (Required) */}
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor="wallet-audit-reason"
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block"
                    >
                      Audit Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="wallet-audit-reason"
                      rows={2}
                      value={auditReason}
                      onChange={(e) => setAuditReason(e.target.value)}
                      placeholder="Specify the regulatory or security reason for these restriction updates..."
                      className="w-full rounded-2xl border border-border/80 bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                    {!auditReason.trim() && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        A valid audit reason is required before changes can be submitted.
                      </p>
                    )}
                  </div>

                  {/* Submit Restrictions Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={!auditReason.trim() || isSavingRestrictions}
                      onClick={() => setIsConfirmRestrictionsOpen(true)}
                      className={cn(
                        "rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs",
                        auditReason.trim() && !isSavingRestrictions
                          ? "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]"
                          : "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                      )}
                    >
                      Save Restrictions
                    </button>
                  </div>
                </div>

                {/* Mini Transaction History */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="size-4 text-muted-foreground" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Recent Ledger Activity
                      </h4>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Last 10 entries
                    </span>
                  </div>

                  {wallet?.recentTransactions && wallet.recentTransactions.length > 0 ? (
                    <div className="divide-y divide-border/50 text-xs">
                      {wallet.recentTransactions.map((tx: any) => {
                        const isTxCredit = tx.entryType === "credit";
                        return (
                          <div
                            key={tx._id}
                            className="py-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-xl transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold text-foreground truncate">
                                {tx.description || tx.referenceType}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {new Date(tx.createdAt).toLocaleDateString()} · Ref:{" "}
                                {tx.referenceId?.slice(0, 10)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={cn(
                                  "font-bold font-mono tabular-nums",
                                  isTxCredit
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-foreground"
                                )}
                              >
                                {isTxCredit ? "+" : "-"}
                                {((tx.amountSantims ?? 0) / 100).toFixed(2)} ETB
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/60">
                      No recent ledger transactions recorded for this player.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Fair Play */}
            {activeTab === "fairplay" && (
              <div className="space-y-5">
                {/* Fair Play Status & Suspicion Score */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Anti-Cheat Status & Suspicion
                      </h4>
                      <p className="text-sm font-bold text-foreground">
                        {fairPlay?.isBanned ? "Account Banned" : "Account in Standing"}
                      </p>
                    </div>
                    <StatusBadge
                      status={fairPlay?.isBanned ? "Banned" : "Clean"}
                      size="md"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Suspicion Score
                      </span>
                      <p className="text-2xl font-black font-mono tabular-nums text-foreground">
                        {fairPlay?.suspicionScore !== undefined
                          ? `${fairPlay.suspicionScore} / 100`
                          : "UNKNOWN"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Reports Filed Against
                      </span>
                      <p className="text-2xl font-black font-mono tabular-nums text-foreground">
                        {fairPlay?.reportsAgainst ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Telemetry Breakdown */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Biometric & Engine Telemetry
                  </h4>

                  {fairPlay?.telemetry ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Blurs / Move:
                        </span>
                        <p className="font-mono font-bold text-foreground">
                          {fairPlay.telemetry.blursPerMove.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Average Centipawn Loss:
                        </span>
                        <p className="font-mono font-bold text-foreground">
                          {fairPlay.telemetry.acpl !== undefined
                            ? `${fairPlay.telemetry.acpl} ACPL`
                            : "N/A"}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Move Time Variance:
                        </span>
                        <p className="font-mono font-bold text-foreground">
                          {fairPlay.telemetry.moveTimeVariance} ms
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/60">
                      No Telemetry Recorded
                    </div>
                  )}
                </div>

                {/* Quick Administrative Action Buttons */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Administrative Sanctions
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsWarnDialogOpen(true)}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-[0.98] transition-all"
                    >
                      Warn Player
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBanDialogOpen(true)}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-[0.98] transition-all"
                    >
                      Ban Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Admin Audit History */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Chronological Administrative Log
                    </h4>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {auditHistory.length} recorded actions
                    </span>
                  </div>

                  {auditHistory.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70">
                      {auditHistory.map((log: any) => {
                        let parsedMeta: any = null;
                        if (log.metadata) {
                          try {
                            parsedMeta = JSON.parse(log.metadata);
                          } catch {
                            parsedMeta = log.metadata;
                          }
                        }

                        return (
                          <div key={log._id} className="relative space-y-1.5 text-xs">
                            <span className="absolute -left-6 top-1 size-2 rounded-full bg-primary ring-4 ring-background" />

                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-foreground capitalize">
                                {log.action?.replace(/_/g, " ")}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(log.createdAt).toLocaleString("en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>

                            <p className="text-muted-foreground leading-relaxed">
                              {log.reason}
                            </p>

                            {/* Changed flags or admin identifier */}
                            <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                              {log.adminId && (
                                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                                  Staff ID: {log.adminId.slice(0, 10)}
                                </span>
                              )}
                              {parsedMeta?.adminClerkId && (
                                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                                  Clerk: {parsedMeta.adminClerkId.slice(0, 12)}
                                </span>
                              )}
                              {parsedMeta?.freezeEntireWallet !== undefined && (
                                <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 font-semibold">
                                  Freeze: {parsedMeta.freezeEntireWallet ? "YES" : "NO"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/60">
                      No administrative actions recorded for this player.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
      </DetailDrawer>

      {/* Confirm Restrictions Dialog */}
      <ConfirmDialog
        isOpen={isConfirmRestrictionsOpen}
        onClose={() => setIsConfirmRestrictionsOpen(false)}
        onConfirm={handleSaveRestrictions}
        title="Confirm Wallet Restriction Changes"
        description="Are you sure you want to commit these wallet status and restriction modifications? This operation is audited and immediately restricts or enables player actions."
        confirmText="Commit Restrictions"
        requireReason={true}
        targetName={profile?.username}
        isLoading={isSavingRestrictions}
      />

      {/* Fair Play Warning Dialog */}
      <ConfirmDialog
        isOpen={isWarnDialogOpen}
        onClose={() => setIsWarnDialogOpen(false)}
        onConfirm={handleWarnPlayer}
        title="Issue Official Fair Play Warning"
        description="Please provide the exact reason and warning message that will be dispatched to this player."
        confirmText="Issue Warning"
        requireReason={true}
        targetName={profile?.username}
        isLoading={isWarningPlayer}
      />

      {/* Fair Play Ban Dialog */}
      <ConfirmDialog
        isOpen={isBanDialogOpen}
        onClose={() => setIsBanDialogOpen(false)}
        onConfirm={handleBanPlayer}
        title="Ban Account for Fair Play Violation"
        description="This will immediately suspend player access and freeze their wallet balances. A mandatory justification is required."
        confirmText="Ban Player"
        requireReason={true}
        isDestructive={true}
        targetName={profile?.username}
        isLoading={isBanningPlayer}
      />
    </>
  );
}
