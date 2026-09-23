"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DepositFlow } from "./deposit-flow";
import { WithdrawFlow } from "./withdraw-flow";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  FileImage,
  History,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
  XCircle,
  BarChart3,
  Calendar,
  Sparkles,
} from "lucide-react";

type Timeframe = "24h" | "7d" | "30d" | "1y" | "all";

export function WalletView() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const balance = useQuery(api.wallets?.getBalance as any, isAuthenticated ? {} : "skip");
  const walletDoc = useQuery(api.wallets?.getOrCreate as any, isAuthenticated ? {} : "skip");
  const deposits = useQuery(api.deposits?.myDeposits as any, isAuthenticated ? {} : "skip");
  const withdrawals = useQuery(api.withdrawals?.myWithdrawals as any, isAuthenticated ? {} : "skip");
  const ensureWallet = useMutation(api.wallets?.ensureWallet as any);

  const [activeTab, setActiveTab] = useState<"overview" | "deposit" | "withdraw">("overview");
  const [historyFilter, setHistoryFilter] = useState<"all" | "deposits" | "withdrawals">("all");
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      ensureWallet().catch(console.error);
    }
  }, [isAuthenticated, ensureWallet]);

  const searchParams = useSearchParams();
  const txId = searchParams?.get("txId");

  // Combine and sort transactions
  const combinedHistory = useMemo(() => {
    return [
      ...(deposits || []).map((d: any) => ({ ...d, type: "deposit" as const })),
      ...(withdrawals || []).map((w: any) => ({ ...w, type: "withdrawal" as const })),
    ].sort((a, b) => (b.createdAt || b._creationTime) - (a.createdAt || a._creationTime));
  }, [deposits, withdrawals]);

  // If txId is present in URL query params, auto-open transaction details modal
  useEffect(() => {
    if (txId && combinedHistory.length > 0) {
      const match = combinedHistory.find((tx: any) => tx._id === txId);
      if (match) {
        setSelectedTx(match);
        setActiveTab("overview");
      }
    }
  }, [txId, combinedHistory]);

  // Studio Analytics Calculation
  const analytics = useMemo(() => {
    const now = Date.now();
    const timeframeMs: Record<Timeframe, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    const maxAge = timeframeMs[timeframe];

    const inRange = (time: number) => now - time <= maxAge;

    const periodDeposits = (deposits || []).filter((d: any) =>
      inRange(d.createdAt || d._creationTime)
    );
    const periodWithdrawals = (withdrawals || []).filter((w: any) =>
      inRange(w.createdAt || w._creationTime)
    );

    const approvedDeposits = periodDeposits
      .filter((d: any) => d.status === "approved")
      .reduce((sum: number, d: any) => sum + d.amount, 0);

    const pendingDepositsCount = periodDeposits.filter((d: any) => d.status === "pending").length;

    const completedWithdrawals = periodWithdrawals
      .filter((w: any) => w.status === "completed")
      .reduce((sum: number, w: any) => sum + w.amount, 0);

    const pendingWithdrawalsCount = periodWithdrawals.filter((w: any) => w.status === "pending").length;

    const netCashflow = approvedDeposits - completedWithdrawals;
    const totalVolume = approvedDeposits + completedWithdrawals;
    const depositPercent = totalVolume > 0 ? Math.round((approvedDeposits / totalVolume) * 100) : 50;

    return {
      approvedDeposits,
      pendingDepositsCount,
      completedWithdrawals,
      pendingWithdrawalsCount,
      netCashflow,
      totalVolume,
      depositPercent,
    };
  }, [deposits, withdrawals, timeframe]);

  if (balance === undefined) {
    if (timedOut) {
      return (
        <div className="mx-auto max-w-md p-8 text-center space-y-4 rounded-3xl border border-border bg-card my-12 shadow-sm">
          <AlertCircle className="size-10 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Connection Slow</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Connecting to your wallet took longer than usual. Please refresh to reconnect.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Refresh Page
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {isAuthLoading ? "Authenticating security key..." : "Loading wallet portfolio..."}
        </p>
      </div>
    );
  }

  const available = balance?.available ?? 0;
  const locked = balance?.locked ?? 0;
  const total = available + locked;

  const totalWon = walletDoc?.totalWon ?? 0;
  const totalLost = walletDoc?.totalLost ?? 0;
  const netChessProfit = totalWon - totalLost;

  const filteredHistory = combinedHistory.filter((item) => {
    if (historyFilter === "deposits") return item.type === "deposit";
    if (historyFilter === "withdrawals") return item.type === "withdrawal";
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-6">
      {/* Top Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/play"
            className="flex size-10 items-center justify-center rounded-2xl border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs group"
            title="Back to Play"
          >
            <ArrowLeft className="size-4.5 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                <Coins className="size-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                ETB Wallet & Studio
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instant deposits via Telebirr, cashouts to CBE Bank, and game escrow analytics.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-2xl bg-muted/40 p-1 border border-border/70">
          <button
            onClick={() => setActiveTab("overview")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "overview"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="size-3.5" />
            Studio Overview
          </button>
          <button
            onClick={() => setActiveTab("deposit")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "deposit"
                ? "bg-emerald-600 text-white shadow-xs font-extrabold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="size-3.5" />
            Deposit
          </button>
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "withdraw"
                ? "bg-primary text-primary-foreground shadow-xs font-extrabold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownLeft className="size-3.5" />
            Withdraw
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Main Balance Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-card via-card to-emerald-500/5 p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Available ETB Balance
                  </span>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-500 flex items-center gap-1">
                    <ShieldCheck className="size-3" />
                    Verified Escrow
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-500 drop-shadow-xs">
                    {available.toLocaleString()}
                  </span>
                  <span className="text-xl font-extrabold text-foreground">ETB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready to stake in 3D chess matches or cash out immediately.
                </p>
              </div>

              {/* Sub-balances Pill Box */}
              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 min-w-[130px]">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Lock className="size-3 text-amber-500" />
                    In Staked Match
                  </span>
                  <p className="text-lg font-black text-amber-500 mt-1">
                    {locked.toLocaleString()} <span className="text-xs font-bold text-foreground">ETB</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 min-w-[130px]">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Total Portfolio
                  </span>
                  <p className="text-lg font-black text-foreground mt-1">
                    {total.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">ETB</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 min-w-[130px]">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3 text-emerald-500" />
                    Net Chess Profit
                  </span>
                  <p className={`text-lg font-black mt-1 ${netChessProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {netChessProfit >= 0 ? `+${netChessProfit.toLocaleString()}` : netChessProfit.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-foreground">ETB</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick action buttons row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-6 mt-6 border-t border-border/60">
              <Button
                size="default"
                onClick={() => setActiveTab("deposit")}
                className="h-11 font-extrabold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 shadow-xs"
              >
                <Plus className="size-4" />
                Deposit ETB
              </Button>
              <Button
                size="default"
                variant="outline"
                onClick={() => setActiveTab("withdraw")}
                className="h-11 font-bold text-xs rounded-xl gap-2 hover:bg-muted"
              >
                <ArrowDownLeft className="size-4 text-emerald-500" />
                Withdraw ETB
              </Button>
              <Link
                href="/play"
                className="inline-flex items-center justify-center h-11 font-bold text-xs rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground transition-colors gap-2"
              >
                <Coins className="size-4 text-amber-500" />
                Find Staked Match
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center justify-center h-11 font-bold text-xs rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground transition-colors gap-2"
              >
                <TrendingUp className="size-4 text-purple-400" />
                View Top Earners
              </Link>
            </div>
          </div>

          {/* YouTube Studio-Style Financial Analytics Section */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="size-4.5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">
                    Studio Financial Analytics
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Performance analytics on your deposits, cashouts, and cash velocity.
                  </p>
                </div>
              </div>

              {/* Timeframe Chips */}
              <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/70 overflow-x-auto">
                {(["24h", "7d", "30d", "1y", "all"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      timeframe === tf
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf === "24h"
                      ? "Today"
                      : tf === "7d"
                      ? "7 Days"
                      : tf === "30d"
                      ? "30 Days"
                      : tf === "1y"
                      ? "1 Year"
                      : "All Time"}
                  </button>
                ))}
              </div>
            </div>

            {/* Analytics Metric Cards Grid */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Deposited
                  </span>
                  <ArrowDownLeft className="size-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-500">
                    +{analytics.approvedDeposits.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-foreground">ETB</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {analytics.pendingDepositsCount > 0 ? (
                    <span className="text-amber-500 font-semibold">
                      {analytics.pendingDepositsCount} pending review
                    </span>
                  ) : (
                    "Fully settled deposits"
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Withdrawn
                  </span>
                  <ArrowUpRight className="size-4 text-primary" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-foreground">
                    -{analytics.completedWithdrawals.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-foreground">ETB</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {analytics.pendingWithdrawalsCount > 0 ? (
                    <span className="text-amber-500 font-semibold">
                      {analytics.pendingWithdrawalsCount} awaiting admin payout
                    </span>
                  ) : (
                    "Processed to bank / Telebirr"
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Net Cashflow
                  </span>
                  <TrendingUp className="size-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-black ${
                      analytics.netCashflow >= 0 ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {analytics.netCashflow >= 0 ? `+${analytics.netCashflow.toLocaleString()}` : analytics.netCashflow.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-foreground">ETB</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Net funding retained in account
                </p>
              </div>
            </div>

            {/* Velocity Visual Ratio Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-500 flex items-center gap-1">
                  ● Inflow: {analytics.depositPercent}%
                </span>
                <span className="text-muted-foreground flex items-center gap-1">
                  ● Outflow: {100 - analytics.depositPercent}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${analytics.depositPercent}%` }}
                />
                <div
                  className="h-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${100 - analytics.depositPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Transaction History Section */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <History className="size-4.5 text-primary" />
                <div>
                  <h3 className="font-extrabold text-foreground text-sm sm:text-base">
                    Transaction History & Receipts
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Tap any transaction to view full details, screenshot receipt, and verification status.
                  </p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 self-start sm:self-auto rounded-xl bg-background p-1 border">
                {(["all", "deposits", "withdrawals"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors capitalize ${
                      historyFilter === filter
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Clickable List */}
            <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <Coins className="size-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm font-bold text-foreground">No transactions found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Deposit ETB via Telebirr or win a staked game to record your first transaction.
                  </p>
                </div>
              ) : (
                filteredHistory.map((item: any) => {
                  const isDeposit = item.type === "deposit";
                  const isPending = item.status === "pending";
                  const isApproved = item.status === "approved" || item.status === "completed";
                  const isRejected = item.status === "rejected";

                  return (
                    <div
                      key={item._id}
                      onClick={() => setSelectedTx(item)}
                      role="button"
                      tabIndex={0}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-muted/40 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`rounded-2xl p-2.5 mt-0.5 shrink-0 ${
                            isDeposit
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="size-4.5" />
                          ) : (
                            <ArrowUpRight className="size-4.5" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-foreground">
                              {isDeposit ? `Deposit ${item.code}` : `Cashout (${item.payoutMethod?.toUpperCase()})`}
                            </span>
                            {item.screenshotUrl && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                <FileImage className="size-2.5" /> Receipt
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {new Date(item.createdAt || item._creationTime).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {isRejected && item.rejectionReason && (
                            <p className="text-xs text-destructive font-medium line-clamp-1">
                              Reason: {item.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pl-12 sm:pl-0">
                        <span
                          className={`text-base font-black ${
                            isDeposit ? "text-emerald-500" : "text-foreground"
                          }`}
                        >
                          {isDeposit ? "+" : "-"}
                          {item.amount.toLocaleString()} ETB
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                            isApproved
                              ? "bg-emerald-500/15 text-emerald-500"
                              : isPending
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {isApproved && <CheckCircle2 className="size-3" />}
                          {isPending && <Clock className="size-3" />}
                          {isRejected && <XCircle className="size-3" />}
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "deposit" && <DepositFlow />}
      {activeTab === "withdraw" && <WithdrawFlow />}

      {/* Transaction Details Inspector Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/90 bg-card text-card-foreground p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl shadow-xs ${
                    selectedTx.type === "deposit"
                      ? "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30"
                      : "bg-primary/15 text-primary ring-1 ring-primary/30"
                  }`}
                >
                  {selectedTx.type === "deposit" ? (
                    <ArrowDownLeft className="size-5" />
                  ) : (
                    <ArrowUpRight className="size-5" />
                  )}
                </span>
                <div>
                  <h3 className="font-black text-base text-foreground">
                    {selectedTx.type === "deposit" ? "Deposit Details" : "Cashout Details"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Reference: {selectedTx.code || selectedTx._id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="rounded-2xl border border-border/80 bg-muted/40 p-4.5 text-center space-y-1.5 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Transaction Amount
              </span>
              <p
                className={`text-3xl sm:text-4xl font-black ${
                  selectedTx.type === "deposit" ? "text-emerald-500" : "text-foreground"
                }`}
              >
                {selectedTx.type === "deposit" ? "+" : "-"}
                {selectedTx.amount?.toLocaleString()} ETB
              </p>
              <div className="pt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                    selectedTx.status === "approved" || selectedTx.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40"
                      : selectedTx.status === "pending"
                      ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/40"
                      : "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
                  }`}
                >
                  {selectedTx.status === "approved" || selectedTx.status === "completed" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : selectedTx.status === "pending" ? (
                    <Clock className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  {selectedTx.status}
                </span>
              </div>
            </div>

            {/* High-Contrast Data Rows */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 shadow-xs">
                <span className="font-semibold text-muted-foreground">Date & Time</span>
                <span className="font-bold text-foreground">
                  {new Date(selectedTx.createdAt || selectedTx._creationTime).toLocaleString()}
                </span>
              </div>

              {selectedTx.code && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 shadow-xs">
                  <span className="font-semibold text-muted-foreground">Reference Code</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-primary px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/25">
                      {selectedTx.code}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedTx.code);
                        toast.success("Code copied to clipboard!");
                      }}
                      className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                      title="Copy code"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {selectedTx.senderInfo && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 shadow-xs">
                  <span className="font-semibold text-muted-foreground">Sender Account / Phone</span>
                  <span className="font-bold text-foreground">{selectedTx.senderInfo}</span>
                </div>
              )}

              {selectedTx.payoutAccount && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 shadow-xs">
                  <span className="font-semibold text-muted-foreground">Payout Destination</span>
                  <span className="font-bold text-foreground">
                    {selectedTx.payoutMethod?.toUpperCase()}: {selectedTx.payoutAccount}
                  </span>
                </div>
              )}

              {selectedTx.rejectionReason && (
                <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider block">
                    Admin Rejection Reason:
                  </span>
                  <p className="text-xs leading-relaxed font-semibold">{selectedTx.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Receipt Preview */}
            {selectedTx.screenshotUrl && (
              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <FileImage className="size-4 text-primary" />
                    Attached Payment Receipt
                  </span>
                  <a
                    href={selectedTx.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-[11px] font-bold"
                  >
                    <ExternalLink className="size-3.5" /> Open Full
                  </a>
                </div>
                <div className="max-h-56 overflow-hidden rounded-2xl border border-border/90 bg-muted/20 dark:bg-black/40 flex items-center justify-center p-2 shadow-inner">
                  <img
                    src={selectedTx.screenshotUrl}
                    alt="Receipt Screenshot"
                    className="max-h-52 w-auto object-contain rounded-xl shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full h-11 font-bold text-xs shadow-xs"
                onClick={() => setSelectedTx(null)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
