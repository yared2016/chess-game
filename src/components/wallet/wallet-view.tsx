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
  Lock,
  Search,
  ShieldCheck,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trophy,
  ChevronDown,
  Layers,
  Sparkles,
  TrendingUp,
  X,
  Copy,
  Check,
  Filter,
  CheckCheck,
} from "lucide-react";
import { DepositModal } from "./deposit-modal";
import { WithdrawModal } from "./withdraw-modal";
import { EarningsChart } from "./earnings-chart";
import { TransactionDetailModal, TransactionDetail } from "./transaction-detail-modal";
import { exportTransactionsToCsv } from "@/lib/export-csv";
import { getChapaFeeRatePercent } from "@/lib/payments/money";
import { useSearchParams } from "next/navigation";

function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const p = parseFloat(val);
    if (!isNaN(p)) return p;
  }
  return fallback;
}

function safeFixed(val: unknown, digits = 2): string {
  return safeNum(val).toFixed(digits);
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "match_entries", label: "Match Entries" },
  { key: "match_winnings", label: "Match Winnings" },
  { key: "fees", label: "Fees" },
  { key: "adjustments", label: "Adjustments" },
];

export function WalletView() {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const verifyRef = searchParams?.get("verifyRef") || searchParams?.get("tx_ref");

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      if (!isMounted) {
        return { start, end, label: "Last 7 Days" };
      }
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
  }, [datePreset, customStart, customEnd, isMounted]);

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
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

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

  const userWithdrawals = useQuery(
    api.financial.withdrawals.myWithdrawals,
    isAuthenticated ? { limit: 10 } : "skip"
  );

  const pendingWithdrawals = useMemo(() => {
    if (!userWithdrawals) return [];
    return userWithdrawals.filter((w) => w.status === "processing" || w.status === "reserved");
  }, [userWithdrawals]);

  useEffect(() => {
    if (isAuthenticated) {
      ensureWallet().catch(console.error);
    }
  }, [isAuthenticated, ensureWallet]);

  // Handle Return from Chapa Deposit
  useEffect(() => {
    if (!verifyRef) return;

    let isSubscribed = true;
    const toastId = toast.loading("Verifying deposit with Chapa...");

    fetch("/api/finance/deposit/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalTxRef: verifyRef }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        if (data.status === "success") {
          toast.success(
            data.alreadyCredited
              ? "Deposit confirmed! Your wallet is credited."
              : `Deposit successful! +${data.creditEtb?.toFixed(2) ?? ""} ETB credited to your wallet.`,
            { id: toastId }
          );
        } else if (data.status === "failed") {
          toast.error(`Deposit verification failed: ${data.error || "Payment not completed."}`, { id: toastId });
        } else {
          toast.info("Deposit is processing. Funds will reflect shortly.", { id: toastId });
        }
      })
      .catch(() => {
        if (isSubscribed) {
          toast.error("Could not verify deposit status.", { id: toastId });
        }
      })
      .finally(() => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("verifyRef");
          url.searchParams.delete("tx_ref");
          url.searchParams.delete("status");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        } catch {
          // ignore
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [verifyRef]);

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

  const copyRefToClipboard = (ref: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ref);
    setCopiedRefId(ref);
    toast.success("Reference ID copied");
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  const currentTabObj = FILTER_TABS.find((t) => t.key === tableTab) || FILTER_TABS[0];

  return (
    <div className="mx-auto max-w-7xl w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* =========================================================
          TOP BAR: Title, Subtitle, Date Picker, Export
          ========================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs shrink-0">
            <Wallet className="size-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Wallet
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your funds, track gaming earnings, and monitor real-time financial activity.
            </p>
          </div>
        </div>

        {/* Date Selector & Export Actions */}
        <div className="flex items-center gap-2 relative">
          {/* Date Range Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted/50 transition-colors"
              aria-label="Filter by date range"
            >
              <Calendar className="size-3.5 text-primary" />
              <span className="truncate max-w-[140px] sm:max-w-none">{dateRange.label}</span>
              <ChevronDown className={`size-3 text-muted-foreground transition-transform ${isDateDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Click-outside backdrop */}
            {isDateDropdownOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
                onClick={() => setIsDateDropdownOpen(false)}
              />
            )}

            {isDateDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <div className="space-y-0.5 text-xs font-medium">
                  {[
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "7days", label: "Last 7 Days" },
                    { key: "30days", label: "Last 30 Days" },
                    { key: "thisMonth", label: "This Month" },
                    { key: "lastMonth", label: "Last Month" },
                    { key: "thisYear", label: "This Year" },
                    { key: "allTime", label: "All Time (Lifetime)" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => {
                        setDatePreset(p.key as DatePreset);
                        setIsDateDropdownOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-all ${
                        datePreset === p.key
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-foreground hover:bg-muted/70"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Range */}
                <div className="border-t border-border/60 mt-2.5 pt-2.5 text-xs">
                  <p className="px-2 py-1 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Custom Date Range
                  </p>
                  <div className="space-y-1.5 px-1">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="w-full rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setCustomEnd(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="w-full rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {datePreset === "custom" && customStart && customEnd && (
                      <button
                        onClick={() => setIsDateDropdownOpen(false)}
                        className="w-full rounded-xl bg-primary py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110 transition-all mt-1"
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
            className="flex items-center gap-2 rounded-xl border-border/80 bg-card px-3 py-2 text-xs font-semibold shadow-xs hover:bg-muted/50 transition-colors"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* =========================================================
          ROW 1: Primary Wallet Balance Card (Adaptive Theme!)
          ========================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Hero Card: Current Wallet Balance with Instant Actions */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/20 p-5 sm:p-7 shadow-xs lg:col-span-7 flex flex-col justify-between space-y-6">
          {/* Subtle Ambient Background Highlight */}
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          {/* Top Bar inside Hero */}
          <div className="flex items-center justify-between border-b border-border/50 pb-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="size-4" />
              </span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold tracking-tight text-foreground">
                  Current Wallet Balance
                </h2>
                <p className="text-[11px] text-muted-foreground">Authoritative ETB Ledger</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span>Verified &bull; Chapa Secured</span>
            </div>
          </div>

          {/* Balance Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 relative z-10">
            {/* Available Balance */}
            <div className="space-y-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Available to Play &amp; Cash Out
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-bold tracking-tight text-foreground">
                  {formatCurrency(availableBal)}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-primary">ETB</span>
              </div>
              <p className="flex items-center gap-1.5 pt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready for active play
              </p>
            </div>

            {/* Locked Balance */}
            <div className="border-t sm:border-t-0 sm:border-l border-border/60 pt-3 sm:pt-0 sm:pl-4 space-y-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Locked / In-Match Hold
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight text-muted-foreground">
                  {formatCurrency(lockedBal)}
                </span>
                <span className="text-xs font-mono font-semibold text-muted-foreground">ETB</span>
              </div>
              <p className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Lock className="size-3 shrink-0" />
                <span>
                  {pendingWithdrawals.length > 0
                    ? `${pendingWithdrawals.length} pending transfer${pendingWithdrawals.length > 1 ? "s" : ""}`
                    : "Held in active matches"}
                </span>
              </p>
            </div>

            {/* Total Balance */}
            <div className="border-t sm:border-t-0 sm:border-l border-border/60 pt-3 sm:pt-0 sm:pl-4 space-y-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Net Balance
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight text-foreground">
                  {formatCurrency(totalBal)}
                </span>
                <span className="text-xs font-mono font-semibold text-primary">ETB</span>
              </div>
              <p className="pt-0.5 text-[11px] font-medium text-muted-foreground">
                Available + Locked
              </p>
            </div>
          </div>

          {/* Quick Action Buttons directly in Hero for Instant Accessibility */}
          <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-3 relative z-10">
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="flex items-center justify-center gap-2 h-11 sm:h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-xs hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <ArrowDownLeft className="size-4 shrink-0" />
              <span>Deposit Funds</span>
            </button>
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="flex items-center justify-center gap-2 h-11 sm:h-12 rounded-2xl border border-border/80 bg-muted/60 text-foreground font-bold text-xs sm:text-sm hover:bg-muted active:scale-[0.99] transition-all"
            >
              <ArrowUpRight className="size-4 shrink-0" />
              <span>Withdraw Funds</span>
            </button>
          </div>
        </div>

        {/* Right Card: Your Earnings (Gaming Performance) */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Trophy className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground">
                  Your Earnings
                </h2>
                <p className="text-[11px] text-muted-foreground">{dateRange.label}</p>
              </div>
            </div>
            <span className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {datePreset === "allTime" ? "Lifetime" : "Filtered"}
            </span>
          </div>

          {/* Big Net Gaming Result */}
          <div className="py-1 space-y-1">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl sm:text-4xl font-mono font-bold tracking-tight ${
                  period.netGamingResult >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {period.netGamingResult >= 0 ? "+" : ""}
                {formatCurrency(period.netGamingResult)}{" "}
                <span className="text-base font-sans font-semibold">ETB</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Net Gaming Result
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Profit from chess matches (Match Winnings minus Match Entry Fees).
            </p>
          </div>

          {/* 3 Metrics Row */}
          <div className="grid grid-cols-3 gap-2.5 border-t border-border/60 pt-3 text-center">
            <div className="rounded-2xl bg-muted/30 p-2.5 border border-border/40">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Winnings
              </p>
              <p className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                +{safeFixed(period.matchWinnings)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-2.5 border border-border/40">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Entries
              </p>
              <p className="font-mono text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                -{safeFixed(period.matchEntries)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-2.5 border border-border/40">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Matches
              </p>
              <p className="font-mono text-xs sm:text-sm font-bold text-foreground">
                {safeNum(period.matchesPlayed)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          PENDING TRANSFERS BANNER (if any)
          ========================================================= */}
      {pendingWithdrawals.length > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs sm:text-sm">
              <Clock className="size-4 animate-pulse" />
              <span>Pending Withdrawal Transfers In Flight</span>
            </div>
            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              {pendingWithdrawals.length} processing
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pendingWithdrawals.map((w) => (
              <div
                key={w._id}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card text-xs shadow-2xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <span className="text-primary font-mono">{safeFixed((w.requestedAmountSantims || 0) / 100)} ETB</span>
                    <span className="text-muted-foreground font-normal">&rarr; {w.bankName}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Recipient: <span className="text-foreground font-medium">{w.accountHolderName}</span> ({w.accountNumberMasked})
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    {w.status}
                  </span>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Ref: {(w.internalTransferRef || "").slice(-10)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          ROW 2: Earnings Over Time + Money Flow + Lifetime Overview
          ========================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Earnings Chart */}
        <div className="lg:col-span-5">
          <EarningsChart data={period.chartData} />
        </div>

        {/* Middle: Money Flow (In vs Out, Cleanly Stacked to NEVER wrap awkwardly!) */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </span>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Money Flow
              </h3>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {dateRange.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Money In */}
            <div className="rounded-2xl bg-emerald-500/5 p-3.5 border border-emerald-500/15 flex flex-col justify-between space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Money In
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Deposits</span>
                  <span className="font-mono font-semibold text-foreground">
                    +{safeFixed(period.deposits?.total)} ETB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Winnings</span>
                  <span className="font-mono font-semibold text-foreground">
                    +{safeFixed(period.matchWinnings)} ETB
                  </span>
                </div>
              </div>
              <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span>Total In:</span>
                <span className="font-mono">
                  +{safeFixed(safeNum(period.deposits?.total) + safeNum(period.matchWinnings))} ETB
                </span>
              </div>
            </div>

            {/* Money Out */}
            <div className="rounded-2xl bg-rose-500/5 p-3.5 border border-rose-500/15 flex flex-col justify-between space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Money Out
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Withdrawals</span>
                  <span className="font-mono font-semibold text-foreground">
                    -{safeFixed(period.withdrawals?.total)} ETB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Match Entries</span>
                  <span className="font-mono font-semibold text-foreground">
                    -{safeFixed(period.matchEntries)} ETB
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px]">Chapa Fees</span>
                  <span className="font-mono font-semibold">
                    -{safeFixed(period.chapaFees?.total)} ETB
                  </span>
                </div>
              </div>
              <div className="border-t border-rose-500/20 pt-2 flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                <span>Total Out:</span>
                <span className="font-mono">
                  -{safeFixed(safeNum(period.withdrawals?.total) + safeNum(period.matchEntries) + safeNum(period.chapaFees?.total))} ETB
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50">
            <span>Gateway Transfer Fee</span>
            <span className="font-mono font-semibold text-foreground">{getChapaFeeRatePercent()}% (incl. VAT)</span>
          </div>
        </div>

        {/* Right: Lifetime Financial Summary */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lifetime Summary
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground">All time</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Total Deposited</span>
              <span className="font-mono font-semibold text-foreground">
                {safeFixed(lifetime.totalDeposited)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Total Withdrawn</span>
              <span className="font-mono font-semibold text-foreground">
                {safeFixed(lifetime.totalWithdrawn)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Match Entries</span>
              <span className="font-mono font-semibold text-foreground">
                {safeFixed(lifetime.totalMatchEntries)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted-foreground">Match Winnings</span>
              <span className="font-mono font-semibold text-foreground">
                {safeFixed(lifetime.totalMatchWinnings)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-border/60 font-bold">
              <span className="text-foreground">Net Gaming Profit</span>
              <span
                className={`font-mono ${
                  safeNum(lifetime.netGamingResult) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {safeNum(lifetime.netGamingResult) >= 0 ? "+" : ""}
                {safeFixed(lifetime.netGamingResult)} ETB
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5 text-[11px] text-muted-foreground">
              <span>Chapa Fees Paid</span>
              <span className="font-mono">{safeFixed(lifetime.totalChapaFees)} ETB</span>
            </div>
            <div className="flex items-center justify-between py-0.5 text-[11px] text-muted-foreground">
              <span>Matches Played</span>
              <span className="font-mono">{safeNum(lifetime.completedMatches)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          BOTTOM: Recent Transactions Table & Mobile Card List
          (ZERO HORIZONTAL SCROLL ON MOBILE!)
          ========================================================= */}
      <div id="recent-transactions-section" className="rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs space-y-4">
        {/* Header with Title and Result Count */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Transaction History
            </h2>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
              {transactions?.length ?? 0}
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Click any row to view complete receipt
          </div>
        </div>

        {/* Filter Controls: NO HORIZONTAL SCROLLING! */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          {/* MOBILE VIEW: Category Selector Dropdown & Quick Badges (100% fits screen, NO scroll bar) */}
          <div className="sm:hidden w-full space-y-2">
            {/* Quick Segmented Top 3 Pills + More Category Select */}
            <div className="grid grid-cols-4 gap-1.5 w-full">
              {[
                { key: "all", label: "All" },
                { key: "deposits", label: "Deposit" },
                { key: "withdrawals", label: "Withdraw" },
                { key: "match_entries", label: "Matches" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTableTab(tab.key)}
                  className={`py-1.5 rounded-xl text-xs font-semibold text-center transition-all ${
                    tableTab === tab.key
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Additional Categories Select Dropdown for Mobile */}
            <div className="relative">
              <select
                value={tableTab}
                onChange={(e) => setTableTab(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border/70 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              >
                {FILTER_TABS.map((tab) => (
                  <option key={tab.key} value={tab.key}>
                    Filter: {tab.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* DESKTOP VIEW: Full Horizontal Segmented Filter Bar */}
          <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/60">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTableTab(tab.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  tableTab === tab.key
                    ? "bg-card text-foreground font-bold shadow-xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
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
              placeholder="Search reference, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* =========================================================
            MOBILE VIEW: Elegant Fintech Cards (Zero horizontal scroll!)
            ========================================================= */}
        <div className="space-y-2 sm:hidden">
          {transactions && transactions.length > 0 ? (
            transactions.map((tx: any) => (
              <div
                key={tx.id}
                onClick={() =>
                  setSelectedTx({
                    id: tx.id,
                    timestamp: tx.timestamp,
                    type: tx.type,
                    entryType: tx.entryType,
                    isCredit: tx.isCredit,
                    amountEtb: safeNum(tx.amountEtb),
                    feeEtb: safeNum(tx.feeEtb),
                    netEtb: safeNum(tx.netEtb),
                    status: tx.status as any,
                    method: tx.method,
                    reference: tx.reference,
                    description: tx.description,
                  })
                }
                className="flex items-center justify-between p-3.5 rounded-2xl border border-border/70 bg-card active:bg-muted/50 transition-colors cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
                      tx.isCredit
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {tx.isCredit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-foreground truncate">{tx.type}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span>
                        {new Date(tx.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>&bull;</span>
                      <span className="truncate">{tx.method || "Wallet"}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1 pl-2">
                  <p
                    className={`font-mono text-xs font-bold ${
                      tx.isCredit
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {tx.isCredit ? "+" : "-"}
                    {safeFixed(tx.amountEtb)} ETB
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      tx.status === "Completed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : tx.status === "Processing" || tx.status === "Locked"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground text-xs space-y-2">
              <p>No transactions found for &ldquo;{currentTabObj.label}&rdquo;.</p>
              {tableTab !== "all" && (
                <button
                  onClick={() => setTableTab("all")}
                  className="text-primary font-bold hover:underline"
                >
                  Show All Transactions
                </button>
              )}
            </div>
          )}
        </div>

        {/* =========================================================
            DESKTOP VIEW: High-Contrast 9-Column Table
            ========================================================= */}
        <div className="hidden sm:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Fee</th>
                <th className="py-3 px-3">Net Impact</th>
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
                        amountEtb: safeNum(tx.amountEtb),
                        feeEtb: safeNum(tx.feeEtb),
                        netEtb: safeNum(tx.netEtb),
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
                    <td className="py-3 px-3 font-bold text-foreground flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`size-2 rounded-full ${
                          tx.isCredit ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {tx.type}
                    </td>
                    <td
                      className={`py-3 px-3 font-mono font-bold whitespace-nowrap ${
                        tx.isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {tx.isCredit ? "+" : "-"}
                      {safeFixed(tx.amountEtb)} ETB
                    </td>
                    <td className="py-3 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      {safeNum(tx.feeEtb) > 0 ? `${safeFixed(tx.feeEtb)} ETB` : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {safeNum(tx.netEtb) >= 0 ? "+" : ""}
                      {safeFixed(tx.netEtb)} ETB
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          tx.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : tx.status === "Processing" || tx.status === "Locked"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-foreground font-medium whitespace-nowrap">{tx.method}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      <button
                        onClick={(e) => copyRefToClipboard(tx.reference, e)}
                        className="inline-flex items-center gap-1 hover:text-primary transition-colors text-[11px]"
                        title="Click to copy reference"
                      >
                        <span>{tx.reference.slice(-12)}</span>
                        {copiedRefId === tx.reference ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3 opacity-50 group-hover:opacity-100" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">{tx.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                    No transactions found for this filter.
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
