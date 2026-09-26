"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Download,
  Info,
  Lock,
  Search,
  ShieldCheck,
  Swords,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  HelpCircle,
  Trophy,
  ChevronDown,
  Layers,
  Coins,
} from "lucide-react";
import { DepositModal } from "./deposit-modal";
import { WithdrawModal } from "./withdraw-modal";
import { EarningsChart } from "./earnings-chart";
import { TransactionDetailModal, TransactionDetail } from "./transaction-detail-modal";
import { exportTransactionsToCsv } from "@/lib/export-csv";
import Link from "next/link";
import { getChapaFeeRatePercent } from "@/lib/payments/money";

type DatePreset =
  | "today"
  | "yesterday"
  | "7days"
  | "30days"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "allTime"
  | "custom";

export function WalletView() {
  const { isAuthenticated } = useConvexAuth();

  // Date Range State
  const [datePreset, setDatePreset] = useState<DatePreset>("7days");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const dateRange = useMemo(() => {
    const now = new Date();
    const end = now.getTime();

    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { start, end, label: "Today" };
    }
    if (datePreset === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      const endOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        23,
        59,
        59,
        999
      ).getTime();
      return { start, end: endOfYesterday, label: "Yesterday" };
    }
    if (datePreset === "7days") {
      const start = new Date(now.getTime() - 7 * 86400000).getTime();
      const startFormatted = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endFormatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return { start, end, label: `${startFormatted} - ${endFormatted}` };
    }
    if (datePreset === "30days") {
      const start = new Date(now.getTime() - 30 * 86400000).getTime();
      return { start, end, label: "Last 30 Days" };
    }
    if (datePreset === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start, end, label: "This Month" };
    }
    if (datePreset === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      return { start, end: endOfLast, label: "Last Month" };
    }
    if (datePreset === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      return { start, end, label: "This Year" };
    }
    if (datePreset === "custom" && customStart && customEnd) {
      const start = new Date(customStart).getTime();
      const endCustom = new Date(`${customEnd}T23:59:59.999`).getTime();
      return { start, end: endCustom, label: `${customStart} - ${customEnd}` };
    }
    return { start: 0, end, label: "All Time" };
  }, [datePreset, customStart, customEnd]);

  // Backend queries from authoritative Convex financial engine
  const overview = useQuery(
    api.financial.analytics.getWalletOverview,
    isAuthenticated ? {} : "skip"
  );

  const periodAnalytics = useQuery(
    api.financial.analytics.getPeriodAnalytics,
    isAuthenticated
      ? { startTimestamp: dateRange.start, endTimestamp: dateRange.end }
      : "skip"
  );

  // Table State
  const [tableTab, setTableTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null);

  const transactions = useQuery(
    api.financial.analytics.getTransactions,
    isAuthenticated
      ? {
          type: tableTab,
          search: searchQuery,
          startTimestamp: dateRange.start > 0 ? dateRange.start : undefined,
          endTimestamp: dateRange.end,
          limit: 100,
        }
      : "skip"
  );

  const ensureWallet = useMutation(api.wallets.ensureWallet);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      ensureWallet().catch(console.error);
    }
  }, [isAuthenticated, ensureWallet]);

  // Balances
  const availableBal = overview?.availableBalance ?? 0;
  const lockedBal = overview?.lockedBalance ?? 0;
  const totalBal = overview?.totalBalance ?? (availableBal + lockedBal);

  const lifetime = overview?.lifetime ?? {
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalMatchEntries: 0,
    totalMatchWinnings: 0,
    netGamingResult: 0,
    totalChapaFees: 0,
    completedMatches: 0,
    depositsCount: 0,
    withdrawalsCount: 0,
  };

  const period = periodAnalytics ?? {
    netGamingResult: 0,
    matchWinnings: 0,
    matchEntries: 0,
    matchesPlayed: 0,
    deposits: { total: 0, count: 0 },
    withdrawals: { total: 0, count: 0 },
    chapaFees: { total: 0, count: 0 },
    topPerformance: {
      bestDay: { date: "—", netResult: 0 },
      highestWin: { matchId: "—", amount: 0 },
    },
    chartData: [],
  };

  const handleExportCsv = () => {
    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export for the selected period.");
      return;
    }
    exportTransactionsToCsv(
      transactions.map((t: any) => ({
        timestamp: t.timestamp,
        type: t.type,
        amountEtb: t.amountEtb,
        feeEtb: t.feeEtb,
        netEtb: t.netEtb,
        status: t.status,
        method: t.method,
        reference: t.reference,
        description: t.description,
      }))
    );
    toast.success("Transactions exported to CSV!");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* =========================================================
          TOP HEADER: Title, Date Picker, Export Button
          ========================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 shadow-sm">
            <Wallet className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Wallet
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Manage your funds, track your earnings and view your financial activity.
            </p>
          </div>
        </div>

        {/* Date Selector & Export Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-muted/50 transition-colors dark:border-border/60 dark:bg-zinc-900"
            >
              <Calendar className="size-3.5 text-amber-500" />
              <span>{dateRange.label}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-md dark:border-border/60 dark:bg-zinc-950">
                <div className="space-y-0.5 text-xs font-semibold">
                  {[
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "7days", label: "Last 7 Days" },
                    { key: "30days", label: "Last 30 Days" },
                    { key: "thisMonth", label: "This Month" },
                    { key: "lastMonth", label: "Last Month" },
                    { key: "thisYear", label: "This Year" },
                    { key: "allTime", label: "All Time" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => {
                        setDatePreset(p.key as DatePreset);
                        setIsDateDropdownOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                        datePreset === p.key
                          ? "bg-amber-500 text-zinc-950 font-bold"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Range Picker */}
                <div className="border-t border-border/60 mt-2 pt-2 text-xs">
                  <p className="px-3 py-1 font-bold text-muted-foreground uppercase text-[10px]">
                    Custom Range
                  </p>
                  <div className="space-y-1.5 px-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="w-full rounded-lg border border-border/80 bg-muted/40 px-2 py-1 text-xs text-foreground"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setCustomEnd(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="w-full rounded-lg border border-border/80 bg-muted/40 px-2 py-1 text-xs text-foreground"
                    />
                    {datePreset === "custom" && customStart && customEnd && (
                      <button
                        onClick={() => setIsDateDropdownOpen(false)}
                        className="w-full rounded-lg bg-amber-500 py-1 text-[11px] font-bold text-zinc-950 hover:bg-amber-400"
                      >
                        Apply Range
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Transactions Button */}
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="flex items-center gap-2 rounded-2xl border-border/80 bg-card px-3.5 py-2 text-xs font-bold shadow-sm hover:bg-muted/50 dark:border-border/60 dark:bg-zinc-900"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export Transactions</span>
          </Button>
        </div>
      </div>

      {/* =========================================================
          ROW 1: Current Wallet Balance Hero + Your Earnings Card
          ========================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Hero Card: Current Wallet Balance */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 text-white shadow-xl lg:col-span-7">
          {/* Top Bar inside Hero */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-800/60 text-amber-400">
                <Wallet className="size-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight">Current Wallet Balance</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/20">
              <ShieldCheck className="size-3.5" />
              <span>Secure & Trusted • Powered by Chapa</span>
            </div>
          </div>

          {/* Balance Metrics Grid */}
          <div className="grid grid-cols-3 gap-4 pt-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Available Balance
              </p>
              <p className="text-2xl font-black font-mono tracking-tight sm:text-3xl text-white">
                {availableBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-sm font-bold text-amber-400">ETB</span>
              </p>
              <p className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready to use
              </p>
            </div>

            <div className="border-l border-zinc-800/80 pl-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Locked Balance
              </p>
              <p className="text-2xl font-black font-mono tracking-tight sm:text-3xl text-zinc-200">
                {lockedBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-sm font-bold text-zinc-400">ETB</span>
              </p>
              <p className="flex items-center gap-1 pt-1 text-[11px] font-semibold text-amber-400">
                <Lock className="size-3" />
                In active matches / hold
              </p>
            </div>

            <div className="border-l border-zinc-800/80 pl-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Total Balance
              </p>
              <p className="text-2xl font-black font-mono tracking-tight sm:text-3xl text-amber-400">
                {totalBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-sm font-bold text-white">ETB</span>
              </p>
              <p className="pt-1 text-[11px] font-medium text-zinc-400">
                Available + Locked
              </p>
            </div>
          </div>
        </div>

        {/* Right Card: Your Earnings (Gaming Result) */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-5">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Trophy className="size-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Your Earnings ({dateRange.label})
              </h2>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {datePreset === "allTime" ? "Lifetime" : dateRange.label}
            </span>
          </div>

          {/* Big Net Gaming Result */}
          <div className="py-3">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-black font-mono tracking-tight sm:text-4xl ${
                  period.netGamingResult >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {period.netGamingResult >= 0 ? "+" : ""}
                {period.netGamingResult.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-lg">ETB</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Net Gaming Result
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground pt-0.5">
              Net profit from completed chess matches (Match Winnings minus Match Entries).
            </p>
          </div>

          {/* 3 Metrics Row */}
          <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-center">
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Match Winnings
              </p>
              <p className="font-mono text-xs font-black text-emerald-500 sm:text-sm">
                +{period.matchWinnings.toFixed(2)} ETB
              </p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Match Entries
              </p>
              <p className="font-mono text-xs font-black text-rose-500 sm:text-sm">
                -{period.matchEntries.toFixed(2)} ETB
              </p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Matches Played
              </p>
              <p className="font-mono text-xs font-black text-foreground sm:text-sm">
                {period.matchesPlayed}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          ROW 2: Earnings Over Time Chart + Money Flow + Quick Actions
          ========================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Earnings Over Time Chart */}
        <div className="lg:col-span-5">
          <EarningsChart data={period.chartData} />
        </div>

        {/* Middle: Money Flow */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Layers className="size-4" />
              </span>
              <h3 className="text-sm font-black tracking-tight text-foreground">
                Money Flow
              </h3>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {dateRange.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3">
            {/* Money In */}
            <div className="space-y-3 rounded-2xl bg-emerald-500/5 p-3.5 border border-emerald-500/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">
                Money In
              </p>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px]">Deposits</span>
                  <p className="font-mono font-bold text-foreground">
                    +{period.deposits.total.toFixed(2)} ETB
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Match Winnings</span>
                  <p className="font-mono font-bold text-foreground">
                    +{period.matchWinnings.toFixed(2)} ETB
                  </p>
                </div>
              </div>
              <div className="border-t border-emerald-500/20 pt-2 font-bold text-xs flex justify-between items-center text-emerald-500">
                <span>Total In:</span>
                <span className="font-mono">
                  +{(period.deposits.total + period.matchWinnings).toFixed(2)} ETB
                </span>
              </div>
            </div>

            {/* Money Out */}
            <div className="space-y-3 rounded-2xl bg-rose-500/5 p-3.5 border border-rose-500/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">
                Money Out
              </p>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px]">Withdrawals</span>
                  <p className="font-mono font-bold text-foreground">
                    -{period.withdrawals.total.toFixed(2)} ETB
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Match Entries</span>
                  <p className="font-mono font-bold text-foreground">
                    -{period.matchEntries.toFixed(2)} ETB
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Chapa Fees (2.6%)</span>
                  <p className="font-mono font-bold text-muted-foreground">
                    -{period.chapaFees.total.toFixed(2)} ETB
                  </p>
                </div>
              </div>
              <div className="border-t border-rose-500/20 pt-2 font-bold text-xs flex justify-between items-center text-rose-500">
                <span>Total Out:</span>
                <span className="font-mono">
                  -{(period.withdrawals.total + period.matchEntries + period.chapaFees.total).toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Quick Actions */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-3 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h3>

          <div className="space-y-2.5">
            {/* Deposit Button */}
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-left text-white shadow-md hover:bg-emerald-500 transition-all font-bold group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-white/20">
                  <ArrowDownLeft className="size-4" />
                </span>
                <div>
                  <p className="text-xs">Deposit Funds</p>
                  <p className="text-[10px] text-emerald-100 font-medium">Instant Chapa Checkout</p>
                </div>
              </div>
              <ArrowDownLeft className="size-4 opacity-75 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Withdraw Button */}
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-left text-white shadow-md hover:bg-zinc-800 transition-all font-bold group dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-zinc-800 text-amber-400">
                  <ArrowUpRight className="size-4" />
                </span>
                <div>
                  <p className="text-xs">Withdraw Funds</p>
                  <p className="text-[10px] text-zinc-400 font-medium">To Telebirr or Bank</p>
                </div>
              </div>
              <ArrowUpRight className="size-4 opacity-75 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="border-t border-border/60 pt-2 space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => {
                const el = document.getElementById("recent-transactions-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span>View Transaction History</span>
              <span>→</span>
            </button>
            <div className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-muted-foreground">
              <span>Chapa Fee</span>
              <span className="font-mono text-amber-500 font-bold">{getChapaFeeRatePercent()}% (incl. VAT)</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          ROW 3: Transaction Overview + Top Performance + Lifetime Summary
          ========================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Transaction Overview */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Transaction Overview ({dateRange.label})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold text-muted-foreground">Deposits</span>
              <p className="font-mono font-bold text-foreground text-sm">{period.deposits.count}</p>
              <p className="font-mono text-[10px] text-emerald-500">+{period.deposits.total.toFixed(2)} ETB</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold text-muted-foreground">Withdrawals</span>
              <p className="font-mono font-bold text-foreground text-sm">{period.withdrawals.count}</p>
              <p className="font-mono text-[10px] text-rose-500">-{period.withdrawals.total.toFixed(2)} ETB</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold text-muted-foreground">Match Entries</span>
              <p className="font-mono font-bold text-foreground text-sm">{period.matchesPlayed}</p>
              <p className="font-mono text-[10px] text-rose-500">-{period.matchEntries.toFixed(2)} ETB</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold text-muted-foreground">Match Winnings</span>
              <p className="font-mono font-bold text-foreground text-sm">{period.matchesPlayed}</p>
              <p className="font-mono text-[10px] text-emerald-500">+{period.matchWinnings.toFixed(2)} ETB</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold text-muted-foreground">Chapa Fees</span>
              <p className="font-mono font-bold text-foreground text-sm">{period.chapaFees.count}</p>
              <p className="font-mono text-[10px] text-muted-foreground">-{period.chapaFees.total.toFixed(2)} ETB</p>
            </div>
          </div>
        </div>

        {/* Middle: Top Performance */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-4 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Top Performance
            </h3>
          </div>
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 font-bold">
                  <TrendingUp className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-foreground">Best Day</p>
                  <p className="text-[11px] text-muted-foreground">{period.topPerformance.bestDay.date}</p>
                </div>
              </div>
              <span className="font-mono font-bold text-emerald-500 text-xs sm:text-sm">
                +{period.topPerformance.bestDay.netResult.toFixed(2)} ETB
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold">
                  <Trophy className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-foreground">Highest Win</p>
                  <p className="text-[11px] text-muted-foreground">{period.topPerformance.highestWin.matchId}</p>
                </div>
              </div>
              <span className="font-mono font-bold text-emerald-500 text-xs sm:text-sm">
                +{period.topPerformance.highestWin.amount.toFixed(2)} ETB
              </span>
            </div>
          </div>
        </div>

        {/* Right: Lifetime Financial Summary */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950 lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Financial Summary (Lifetime)
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Total Deposited</span>
              <span className="font-mono font-bold text-foreground">
                {lifetime.totalDeposited.toFixed(2)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Total Withdrawn</span>
              <span className="font-mono font-bold text-foreground">
                {lifetime.totalWithdrawn.toFixed(2)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Match Entries</span>
              <span className="font-mono font-bold text-foreground">
                {lifetime.totalMatchEntries.toFixed(2)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Match Winnings</span>
              <span className="font-mono font-bold text-foreground">
                {lifetime.totalMatchWinnings.toFixed(2)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-border/60 font-bold">
              <span className="text-foreground">Net Gaming Result</span>
              <span className={`font-mono ${lifetime.netGamingResult >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {lifetime.netGamingResult >= 0 ? "+" : ""}
                {lifetime.netGamingResult.toFixed(2)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5 text-[11px] text-muted-foreground">
              <span>Chapa Fees Paid</span>
              <span className="font-mono">{lifetime.totalChapaFees.toFixed(2)} ETB</span>
            </div>
            <div className="flex items-center justify-between py-0.5 text-[11px] text-muted-foreground">
              <span>Matches Played</span>
              <span className="font-mono">{lifetime.completedMatches}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          BOTTOM: Recent Transactions Table with Search & Tabs
          ========================================================= */}
      <div id="recent-transactions-section" className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm dark:border-border/60 dark:bg-zinc-950 space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "deposits", label: "Deposits" },
              { key: "withdrawals", label: "Withdrawals" },
              { key: "match_entries", label: "Match Entries" },
              { key: "match_winnings", label: "Match Winnings" },
              { key: "fees", label: "Fees" },
              { key: "adjustments", label: "Adjustments" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTableTab(tab.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  tableTab === tab.key
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-border/80 bg-muted/30 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Fee</th>
                <th className="py-3 px-3">Net Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {transactions && transactions.length > 0 ? (
                transactions.map((tx: any) => (
                  <tr
                    key={tx.id}
                    onClick={() =>
                      setSelectedTx({
                        id: tx.id,
                        timestamp: tx.timestamp,
                        type: tx.type,
                        entryType: tx.entryType,
                        isCredit: tx.isCredit,
                        amountEtb: tx.amountEtb,
                        feeEtb: tx.feeEtb,
                        netEtb: tx.netEtb,
                        status: tx.status as any,
                        method: tx.method,
                        reference: tx.reference,
                        description: tx.description,
                      })
                    }
                    className="hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className={`size-2 rounded-full ${
                          tx.isCredit ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {tx.type}
                    </td>
                    <td
                      className={`py-3 px-3 font-mono font-bold whitespace-nowrap ${
                        tx.isCredit ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {tx.isCredit ? "+" : "-"}
                      {tx.amountEtb.toFixed(2)} ETB
                    </td>
                    <td className="py-3 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      {tx.feeEtb > 0 ? `${tx.feeEtb.toFixed(2)} ETB` : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {tx.netEtb >= 0 ? "+" : ""}
                      {tx.netEtb.toFixed(2)} ETB
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          tx.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : tx.status === "Processing" || tx.status === "Locked"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-foreground font-medium whitespace-nowrap">{tx.method}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground group-hover:text-amber-500 transition-colors whitespace-nowrap">
                      {tx.reference}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">{tx.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          MODALS
          ========================================================= */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
      />
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        availableBalanceEtb={availableBal}
        onClose={() => setIsWithdrawModalOpen(false)}
      />
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
