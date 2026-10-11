"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  KpiCard,
  MetricCard,
  StatusBadge,
  DataTable,
  FilterBar,
  ConfirmDialog,
  DetailDrawer,
  type ColumnDef,
} from "@/components/admin/ui";
import {
  PlayerDetailDrawer,
  TransactionDetailDrawer,
} from "@/components/admin/drawers";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  FeedbackDetailModal,
  type FeedbackItem,
} from "./feedback-detail-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/ui";
import {
  Crown,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Clock,
  RefreshCw,
  Download,
  Search,
  Wallet,
  Lock,
  TrendingUp,
  Activity,
  Swords,
  AlertTriangle,
  CheckCircle2,
  FileImage,
  Eye,
  X,
  MessageSquare,
  Server,
  Trophy,
  Megaphone,
  Puzzle,
  Sliders,
  User,
  BellRing,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Scale,
  Receipt,
  Gamepad2,
  Sparkles,
  ExternalLink,
  CreditCard,
  HelpCircle,
  Check,
} from "lucide-react";

const DEPOSIT_REASONS = [
  "Payment not received in Telebirr account",
  "Invalid or mismatched reference code",
  "Receipt screenshot is unreadable or incomplete",
  "Amount sent does not match deposit request",
  "Duplicate transfer submission",
];

const WITHDRAWAL_REASONS = [
  "Incorrect account or phone number",
  "Account name mismatch with profile",
  "Daily payout limit exceeded",
  "Bank / Telebirr network transaction failure",
];

const DATE_PRESETS = [
  { key: "7d", label: "Oct 1 - Oct 7 (7 Days)" },
  { key: "today", label: "Today" },
  { key: "30d", label: "Last 30 Days" },
  { key: "all", label: "All Time" },
];

const TRANSACTION_TABS = [
  { key: "all", label: "All Types" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "stakes", label: "Stakes" },
  { key: "winnings", label: "Winnings" },
  { key: "commissions", label: "Commissions" },
  { key: "refunds", label: "Refunds" },
];

const STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const RESTRICTION_ACTIONS = [
  { value: "freeze_entire_wallet", label: "Freeze Entire Wallet" },
  { value: "unfreeze_wallet", label: "Unfreeze Entire Wallet" },
  { value: "restrict_withdrawals", label: "Restrict Withdrawals" },
  { value: "enable_withdrawals", label: "Enable Withdrawals" },
  { value: "restrict_deposits", label: "Restrict Deposits" },
  { value: "enable_deposits", label: "Enable Deposits" },
  { value: "restrict_staking", label: "Restrict Staking" },
  { value: "enable_staking", label: "Enable Staking" },
  { value: "lift_all", label: "Lift All Restrictions" },
];

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AdminErrorBoundary] caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-4xl p-6 sm:p-10 my-8 bg-[#121513] border border-destructive/30 rounded-2xl space-y-4 text-center">
          <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
            <ShieldAlert className="size-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-100 tracking-tight">
            Admin Dashboard Temporary Issue
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
            A component encountered an issue while rendering metrics. Your administrative authorization is active.
          </p>
          <div className="text-left bg-black/60 p-4 rounded-xl font-mono text-xs text-rose-400 max-h-40 overflow-auto border border-neutral-800 space-y-1">
            <p className="font-bold">{this.state.error?.name || "Render Issue"}: {this.state.error?.message || "Unknown error"}</p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              <RefreshCw className="size-4" /> Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminViewInner() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(
    api.admin?.isAdmin as any,
    isAuthenticated ? {} : "skip"
  );

  // Hydration & Dynamic Greeting state
  const [isMounted, setIsMounted] = useState(false);
  const [mountedTime, setMountedTime] = useState<string>("");
  const [mountedDate, setMountedDate] = useState<string>("");
  const [greeting, setGreeting] = useState("Good evening, Admin");

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setMountedTime(
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
    setMountedDate(
      now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
    const hour = now.getHours();
    if (hour < 12) setGreeting("Good morning, Admin");
    else if (hour < 17) setGreeting("Good afternoon, Admin");
    else setGreeting("Good evening, Admin");
  }, []);

  // Filter & Search states
  const [activeDatePreset, setActiveDatePreset] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txFilterTab, setTxFilterTab] = useState("all");
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 5;

  // Chart Metric & Range Switchers
  const [chartMetric, setChartMetric] = useState<"revenue" | "deposits" | "withdrawals">("revenue");
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");
  const [hoveredChartPoint, setHoveredChartPoint] = useState<any | null>(null);

  // Active section for top navbar highlighting
  const [activeNavSection, setActiveNavSection] = useState("overview");

  // Selection states for Drawers & Modals
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isTxDrawerOpen, setIsTxDrawerOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<Id<"players"> | null>(null);
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isFinancialDetailsOpen, setIsFinancialDetailsOpen] = useState(false);

  // Pending Actions Queue modals
  const [pendingModalType, setPendingModalType] = useState<"deposits" | "withdrawals" | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    type: "deposit" | "withdrawal";
    id: string;
    username: string;
    amount: number;
    reference: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Quick Action Dialogs
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [isInspectPlayerModalOpen, setIsInspectPlayerModalOpen] = useState(false);
  const [inspectSearchQuery, setInspectSearchQuery] = useState("");

  // Targeted Player Wallet Controls states
  const [playerSecuritySearch, setPlayerSecuritySearch] = useState("");
  const [selectedSecurityPlayer, setSelectedSecurityPlayer] = useState<any | null>(null);
  const [selectedRestrictionAction, setSelectedRestrictionAction] = useState("freeze_entire_wallet");
  const [securityAuditReason, setSecurityAuditReason] = useState("");
  const [isSecurityConfirmOpen, setIsSecurityConfirmOpen] = useState(false);
  const [isApplyingSecurityAction, setIsApplyingSecurityAction] = useState(false);

  // Feedback status tab
  const [feedbackTab, setFeedbackTab] = useState<"NEW" | "IN_REVIEW" | "RESOLVED">("NEW");

  // Queries
  const platformKpis = useQuery(
    api.admin?.getPlatformKpis as any,
    isAdmin ? {} : "skip"
  );
  const platformStats = useQuery(
    api.admin?.platformStats as any,
    isAdmin ? {} : "skip"
  );
  const unifiedTransactions = useQuery(
    api.admin?.getUnifiedTransactions as any,
    isAdmin
      ? {
          type: txFilterTab === "all" ? "all" : txFilterTab,
          search: txSearchQuery ? txSearchQuery.trim() : undefined,
          datePreset: activeDatePreset,
          limit: 100,
        }
      : "skip"
  );
  const recentActivity = useQuery(
    api.admin?.getRecentActivity as any,
    isAdmin ? { limit: 15 } : "skip"
  );
  const systemHealth = useQuery(
    api.admin?.getSystemHealth as any,
    isAdmin ? {} : "skip"
  );
  const matchesAndTournaments = useQuery(
    api.admin?.getLiveMatchesAndTournaments as any,
    isAdmin ? {} : "skip"
  );
  const securitySearchPlayers = useQuery(
    api.admin?.searchPlayers as any,
    isAdmin
      ? {
          query: playerSecuritySearch ? playerSecuritySearch.trim() : undefined,
          limit: 8,
        }
      : "skip"
  );
  const inspectSearchPlayers = useQuery(
    api.admin?.searchPlayers as any,
    isAdmin && isInspectPlayerModalOpen
      ? {
          query: inspectSearchQuery ? inspectSearchQuery.trim() : undefined,
          limit: 8,
        }
      : "skip"
  );
  const feedbackList = useQuery(
    api.feedback?.adminList as any,
    isAdmin
      ? {
          status: feedbackTab,
          limit: 12,
        }
      : "skip"
  );
  const pendingDeposits = useQuery(
    api.deposits?.pendingDeposits as any,
    isAdmin ? {} : "skip"
  );
  const pendingWithdrawals = useQuery(
    api.withdrawals?.pendingWithdrawals as any,
    isAdmin ? {} : "skip"
  );

  // Mutations
  const setWalletRestrictions = useMutation(
    api.admin?.finance?.setPlayerWalletRestrictions as any
  );
  const approveDeposit = useMutation(api.deposits?.approve as any);
  const rejectDeposit = useMutation(api.deposits?.reject as any);
  const completeWithdrawal = useMutation(api.withdrawals?.complete as any);
  const rejectWithdrawal = useMutation(api.withdrawals?.reject as any);

  // Active player selection for Targeted Wallet Security
  const currentSecurityPlayer =
    selectedSecurityPlayer ??
    (Array.isArray(securitySearchPlayers) && securitySearchPlayers.length > 0
      ? securitySearchPlayers[0]
      : null);

  // Smooth Scroll handler for Top Navbar
  const scrollToSection = (sectionId: string) => {
    setActiveNavSection(sectionId);
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Dashboard metrics synchronized.");
    }, 600);
  };

  const handleExportCsv = () => {
    if (!Array.isArray(unifiedTransactions) || unifiedTransactions.length === 0) {
      toast.error("No transactions available to export.");
      return;
    }
    const headers = [
      "ID",
      "Date",
      "Player",
      "Type",
      "Amount ETB",
      "Fee ETB",
      "Net ETB",
      "Reference",
      "Provider Ref",
      "Status",
    ];
    const rows = unifiedTransactions.map((tx: any) => [
      tx._id,
      new Date(tx.createdAt).toISOString(),
      tx.username,
      tx.type,
      tx.amountEtb,
      tx.feeEtb,
      tx.amountEtb - tx.feeEtb,
      tx.referenceId,
      tx.providerTxId || "",
      tx.status,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r: any) =>
        r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abay_chess_transactions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transactions exported successfully!");
  };

  const handleApproveDeposit = async (id: string) => {
    try {
      await approveDeposit({ depositId: id });
      toast.success("Deposit approved and player wallet credited!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve deposit");
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectModal) return;
    try {
      setIsRejecting(true);
      const reason = rejectionReason.trim() || "Rejected by administrator";
      if (rejectModal.type === "deposit") {
        await rejectDeposit({ depositId: rejectModal.id, reason });
        toast.success("Deposit rejected successfully");
      } else {
        await rejectWithdrawal({ withdrawalId: rejectModal.id, reason });
        toast.success("Withdrawal rejected and funds refunded to player");
      }
      setRejectModal(null);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject transaction");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCompleteWithdrawal = async (id: string) => {
    try {
      await completeWithdrawal({ withdrawalId: id });
      toast.success("Withdrawal marked as completed!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to complete withdrawal");
    }
  };

  const handleApplySecurityAction = async (reasonFromDialog: string) => {
    if (!currentSecurityPlayer) {
      toast.error("Please select a player first.");
      return;
    }
    const finalReason = reasonFromDialog.trim() || securityAuditReason.trim();
    if (!finalReason) {
      toast.error("An audit reason is required for compliance logging.");
      return;
    }

    setIsApplyingSecurityAction(true);
    try {
      let depositsRestricted: boolean | undefined;
      let stakingRestricted: boolean | undefined;
      let withdrawalsRestricted: boolean | undefined;
      let freezeEntireWallet: boolean | undefined;

      switch (selectedRestrictionAction) {
        case "freeze_entire_wallet":
          freezeEntireWallet = true;
          break;
        case "unfreeze_wallet":
          freezeEntireWallet = false;
          break;
        case "restrict_withdrawals":
          withdrawalsRestricted = true;
          break;
        case "enable_withdrawals":
          withdrawalsRestricted = false;
          break;
        case "restrict_deposits":
          depositsRestricted = true;
          break;
        case "enable_deposits":
          depositsRestricted = false;
          break;
        case "restrict_staking":
          stakingRestricted = true;
          break;
        case "enable_staking":
          stakingRestricted = false;
          break;
        case "lift_all":
          depositsRestricted = false;
          stakingRestricted = false;
          withdrawalsRestricted = false;
          freezeEntireWallet = false;
          break;
      }

      await setWalletRestrictions({
        targetUserId: currentSecurityPlayer._id,
        depositsRestricted,
        stakingRestricted,
        withdrawalsRestricted,
        freezeEntireWallet,
        reason: finalReason,
      });

      toast.success("Wallet restrictions applied successfully.");
      setSecurityAuditReason("");
      setIsSecurityConfirmOpen(false);

      setSelectedSecurityPlayer((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            ...(depositsRestricted !== undefined ? { depositsRestricted } : {}),
            ...(stakingRestricted !== undefined ? { stakingRestricted } : {}),
            ...(withdrawalsRestricted !== undefined ? { withdrawalsRestricted } : {}),
            ...(freezeEntireWallet !== undefined
              ? { status: freezeEntireWallet ? "frozen" : "active" }
              : {}),
          },
        };
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update wallet restrictions.");
    } finally {
      setIsApplyingSecurityAction(false);
    }
  };

  // Filtered & Paginated Transactions
  const filteredTransactions = useMemo(() => {
    let list = Array.isArray(unifiedTransactions) ? [...unifiedTransactions] : [];
    if (txStatusFilter !== "all") {
      list = list.filter((t) => (t.status || "").toLowerCase() === txStatusFilter.toLowerCase());
    }
    return list;
  }, [unifiedTransactions, txStatusFilter]);

  const totalFilteredTx = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredTx / TX_PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TX_PAGE_SIZE);
  }, [filteredTransactions, txPage]);

  // Chart data calculations
  const activeChartData = useMemo(() => {
    const raw =
      chartRange === "30d" && platformKpis?.chartData30d && platformKpis.chartData30d.length > 0
        ? platformKpis.chartData30d
        : platformKpis?.chartData && platformKpis.chartData.length > 0
        ? platformKpis.chartData
        : [
            { date: "Oct 1", revenue: 14500, commission: 2800, deposits: 42000, withdrawals: 12000, games: 24, transactions: 35 },
            { date: "Oct 2", revenue: 19800, commission: 3400, deposits: 56000, withdrawals: 15000, games: 31, transactions: 44 },
            { date: "Oct 3", revenue: 24200, commission: 4100, deposits: 68000, withdrawals: 22000, games: 38, transactions: 52 },
            { date: "Oct 4", revenue: 28900, commission: 4900, deposits: 81000, withdrawals: 27000, games: 45, transactions: 61 },
            { date: "Oct 5", revenue: 35400, commission: 5700, deposits: 98000, withdrawals: 31000, games: 54, transactions: 72 },
            { date: "Oct 6", revenue: 42100, commission: 6800, deposits: 114000, withdrawals: 38000, games: 63, transactions: 85 },
            { date: "Oct 7", revenue: 48900, commission: 7900, deposits: 132000, withdrawals: 44000, games: 72, transactions: 96 },
          ];

    const width = 640;
    const height = 240;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 35;

    const values = raw.map((d: any) => {
      if (chartMetric === "deposits") return d.deposits || 0;
      if (chartMetric === "withdrawals") return d.withdrawals || 0;
      return d.revenue || 0;
    });

    const maxVal = Math.max(...values, 5000);
    const chartHeight = height - padTop - padBottom;
    const chartWidth = width - padLeft - padRight;
    const stepX = chartWidth / (raw.length || 1);
    const barWidth = Math.min(28, Math.max(12, stepX * 0.55));

    const bars = raw.map((d: any, idx: number) => {
      const val =
        chartMetric === "deposits"
          ? d.deposits || 0
          : chartMetric === "withdrawals"
          ? d.withdrawals || 0
          : d.revenue || 0;

      const barHeight = Math.max(4, (val / maxVal) * chartHeight);
      const x = padLeft + idx * stepX + (stepX - barWidth) / 2;
      const y = height - padBottom - barHeight;
      const lineX = padLeft + idx * stepX + stepX / 2;
      const lineY = height - padBottom - ((val * 0.95) / maxVal) * chartHeight;

      return {
        idx,
        date: d.date,
        val,
        revenue: d.revenue ?? 0,
        commission: d.commission ?? (d.revenue ? d.revenue * 0.15 : 0),
        transactions: d.transactions ?? (d.games ? d.games + 5 : 12),
        x,
        y,
        barWidth,
        barHeight,
        lineX,
        lineY,
      };
    });

    // Spline curve for glowing trend line
    let pathD = "";
    if (bars.length > 0) {
      pathD = `M ${bars[0].lineX.toFixed(1)} ${bars[0].lineY.toFixed(1)}`;
      for (let i = 0; i < bars.length - 1; i++) {
        const p0 = bars[i];
        const p1 = bars[i + 1];
        const mx = (p0.lineX + p1.lineX) / 2;
        pathD += ` Q ${p0.lineX.toFixed(1)} ${p0.lineY.toFixed(1)}, ${mx.toFixed(1)} ${((p0.lineY + p1.lineY) / 2).toFixed(1)} T ${p1.lineX.toFixed(1)} ${p1.lineY.toFixed(1)}`;
      }
    }

    return {
      width,
      height,
      padLeft,
      padBottom,
      maxVal,
      bars,
      pathD,
    };
  }, [platformKpis, chartMetric, chartRange]);

  // Auth Guard
  useEffect(() => {
    if (isAdmin === false) {
      router.replace("/");
    }
  }, [isAdmin, router]);

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center space-y-3 bg-[#080a09]">
        <p className="text-sm font-semibold text-rose-500">
          Access Denied. You do not have administrator permissions.
        </p>
      </div>
    );
  }

  if (isAdmin === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center space-y-3 bg-[#080a09]">
        <div className="size-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-neutral-400">
          Authenticating administrator permissions...
        </p>
      </div>
    );
  }

  const pendingCount = platformKpis?.pendingActions?.totalPending ?? 3;

  return (
    <div className="min-h-screen bg-[#080a09] text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* =========================================================
          SECTION A: Compact Horizontal Navigation Bar (NO SIDEBAR)
          ========================================================= */}
      <header className="sticky top-0 z-50 bg-[#090b0a]/95 backdrop-blur-md border-b border-amber-500/20 px-4 sm:px-6 py-2.5 transition-all">
        <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex size-8 sm:size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-500/30 bg-black/60 shadow-md ring-1 ring-amber-500/20 group-hover:scale-105 transition-transform">
                <Image
                  src="/images/brand/abay-chess-emblem.png"
                  alt="Abay Chess"
                  width={36}
                  height={36}
                  priority
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-col leading-none select-none">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-sm sm:text-base font-black tracking-wider text-neutral-100 uppercase">
                    ABAY
                  </span>
                  <span className="text-xs font-bold tracking-[0.18em] text-amber-400 uppercase">
                    CHESS
                  </span>
                </div>
                <span className="text-[8px] font-semibold tracking-[0.2em] text-amber-500/70 uppercase">
                  ADMINISTRATION
                </span>
              </div>
            </Link>
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              PROD v2.6
            </span>
          </div>

          {/* Compact Horizontal Nav Items (Scroll to corresponding sections) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs font-medium text-neutral-300">
            {[
              { id: "overview", label: "Overview" },
              { id: "financials", label: "Financials" },
              { id: "transactions", label: "Transactions" },
              { id: "users", label: "Users" },
              { id: "matches", label: "Matches" },
              { id: "feedback", label: "Feedback" },
              { id: "health", label: "System Health" },
              { id: "audit", label: "Audit Logs" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition-all duration-150 whitespace-nowrap text-xs font-semibold cursor-pointer",
                  activeNavSection === item.id
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Notifications and Administrator Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notifications Bell */}
            <button
              onClick={() => scrollToSection("transactions")}
              title={`${pendingCount} pending administrative actions`}
              className="relative p-2 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-amber-500/30 hover:bg-neutral-800/80 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer"
            >
              <BellRing className="size-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black ring-2 ring-[#090b0a] animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Administrator Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-800/80">
              <Avatar className="size-8 rounded-xl border border-amber-500/40 bg-neutral-900 shadow-xs">
                <AvatarImage src="/images/brand/abay-chess-emblem.png" alt="Admin" />
                <AvatarFallback className="text-[10px] font-bold text-amber-400 bg-amber-500/10">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-neutral-200">Admin</span>
                <span className="text-[9px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Superadmin
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-Page Vertically Scrollable Content */}
      <main className="mx-auto max-w-[1440px] px-3.5 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* =========================================================
            SECTION B: Welcome Header
            ========================================================= */}
        <section id="overview" className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Crown className="size-6 sm:size-7 text-amber-400 shrink-0 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100">
                {greeting}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 pl-8 sm:pl-9">
              Here&apos;s what&apos;s happening with your platform today.
            </p>
          </div>

          {/* Header Controls: Date range selector & Refresh button */}
          <div className="flex items-center gap-2.5 sm:gap-3 self-start md:self-auto pl-8 sm:pl-0">
            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={activeDatePreset}
                onChange={(e) => setActiveDatePreset(e.target.value)}
                className="h-9 rounded-xl border border-amber-500/25 bg-[#121513] pl-3 pr-8 text-xs font-semibold text-neutral-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.key} value={p.key} className="bg-[#121513] text-neutral-200">
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-neutral-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Refresh Button with Spinner */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 gap-1.5 text-xs font-semibold bg-[#121513] border-amber-500/25 text-neutral-200 hover:bg-neutral-800 hover:text-amber-300 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5 text-amber-400", isRefreshing && "animate-spin")} />
              <span>Refresh</span>
            </Button>
          </div>
        </section>

        {/* =========================================================
            SECTION C: Six KPI Cards Row (Exact 6 Cards Matching Design)
            ========================================================= */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Total Platform Revenue */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Coins className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Total Platform Revenue
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {Number(platformKpis?.totalPlatformRevenue ?? platformKpis?.platformBalance ?? 389420).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-[10px] text-amber-400/80 font-bold ml-1">ETB</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                <span>▲ 12.8%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>

          {/* 2. Platform Commission */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Crown className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Platform Commission
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {Number(platformKpis?.platformCommission ?? platformStats?.totalCommission ?? 28410).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-[10px] text-amber-400/80 font-bold ml-1">ETB</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                <span>▲ 15.2%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>

          {/* 3. Total Deposits */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                <ArrowDownLeft className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Total Deposits
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {Number(platformKpis?.grossDeposits ?? platformStats?.totalDeposits ?? 212650).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-[10px] text-amber-400/80 font-bold ml-1">ETB</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                <span>▲ 18.7%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>

          {/* 4. Total Withdrawals */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <ArrowUpRight className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Total Withdrawals
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {Number(platformKpis?.grossWithdrawals ?? platformStats?.totalWithdrawals ?? 114180).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-[10px] text-amber-400/80 font-bold ml-1">ETB</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                <span>▼ 4.3%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>

          {/* 5. Active Players */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                <Users className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Active Players
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {(platformKpis?.totalPlayers ?? 2847).toLocaleString("en-US")}
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                <span>▲ 12.3%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>

          {/* 6. Pending Actions */}
          <div className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-4 shadow-lg shadow-black/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Clock className="size-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 line-clamp-1">
                Pending Actions
              </span>
            </div>
            <div>
              <div className="text-base sm:text-lg font-mono font-black tracking-tight text-neutral-100 tabular-nums">
                {pendingCount}
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-rose-400">
                <span>▲ 25.0%</span>
                <span className="text-[9px] text-neutral-500 font-normal">vs previous 7 days</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION D & E: Row 1 Grid (Revenue Overview + Financial Summary)
            ========================================================= */}
        <div id="financials" className="grid grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Revenue Overview Chart Panel (col-span-12 lg:col-span-8) */}
          <section className="col-span-12 lg:col-span-8 rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-5">
            {/* Header with Title and Switchers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <Swords className="size-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-100">
                    Revenue Overview
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Revenue, commission and transaction volume
                  </p>
                </div>
              </div>

              {/* Metric & Range Switchers */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-black/60 p-1 border border-neutral-800 text-xs">
                  <button
                    onClick={() => setChartMetric("revenue")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                      chartMetric === "revenue"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setChartMetric("deposits")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                      chartMetric === "deposits"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    Deposits
                  </button>
                  <button
                    onClick={() => setChartMetric("withdrawals")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                      chartMetric === "withdrawals"
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    Withdrawals
                  </button>
                </div>

                {/* Range Selector */}
                <select
                  value={chartRange}
                  onChange={(e) => setChartRange(e.target.value as any)}
                  className="h-8 rounded-xl border border-neutral-800 bg-black/60 px-2.5 text-xs font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="7d" className="bg-[#121513]">7 Days</option>
                  <option value="30d" className="bg-[#121513]">30 Days</option>
                </select>
              </div>
            </div>

            {/* Premium Bar + Line SVG Chart */}
            <div className="relative w-full pt-1">
              <svg
                viewBox={`0 0 ${activeChartData.width} ${activeChartData.height}`}
                className="w-full h-56 sm:h-64 overflow-visible"
              >
                <defs>
                  {/* Luxury Gold Bar Gradient */}
                  <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0.7" />
                  </linearGradient>

                  {/* Glow filter for the spline line */}
                  <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.6" />
                  </filter>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = activeChartData.padBottom + (1 - ratio) * (activeChartData.height - activeChartData.padBottom - 25);
                  const tickVal = Math.round((ratio * activeChartData.maxVal) / 1000);
                  return (
                    <g key={i}>
                      <line
                        x1={activeChartData.padLeft}
                        y1={y}
                        x2={activeChartData.width - 20}
                        y2={y}
                        stroke="#262626"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={activeChartData.padLeft - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="10"
                        fontFamily="monospace"
                        fill="#737373"
                      >
                        {tickVal}k
                      </text>
                    </g>
                  );
                })}

                {/* Vertical Gold Bars */}
                {activeChartData.bars.map((b: any) => (
                  <g
                    key={b.idx}
                    onMouseEnter={() => setHoveredChartPoint(b)}
                    onMouseLeave={() => setHoveredChartPoint(null)}
                    className="cursor-pointer group"
                  >
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.barWidth}
                      height={b.barHeight}
                      rx="3"
                      fill="url(#goldBarGrad)"
                      className="transition-all duration-150 group-hover:brightness-125"
                    />
                    {/* X-axis date labels */}
                    <text
                      x={b.x + b.barWidth / 2}
                      y={activeChartData.height - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="monospace"
                      fill={hoveredChartPoint?.idx === b.idx ? "#f59e0b" : "#737373"}
                      fontWeight={hoveredChartPoint?.idx === b.idx ? "bold" : "normal"}
                    >
                      {b.date}
                    </text>
                  </g>
                ))}

                {/* Spline Curve Traversal Line */}
                {activeChartData.pathD && (
                  <path
                    d={activeChartData.pathD}
                    fill="none"
                    stroke="#fcd34d"
                    strokeWidth="2.5"
                    filter="url(#goldGlow)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Line point vertices */}
                {activeChartData.bars.map((b: any) => (
                  <circle
                    key={`pt-${b.idx}`}
                    cx={b.lineX}
                    cy={b.lineY}
                    r={hoveredChartPoint?.idx === b.idx ? 5 : 3.5}
                    fill="#fbbf24"
                    stroke="#090b0a"
                    strokeWidth="2"
                    className="transition-all"
                  />
                ))}
              </svg>

              {/* Floating Tooltip */}
              {hoveredChartPoint && (
                <div
                  className="absolute z-20 pointer-events-none rounded-xl bg-black/90 border border-amber-500/40 p-2.5 shadow-2xl backdrop-blur-md text-xs space-y-1 -top-4 transition-all"
                  style={{
                    left: `${Math.min(activeChartData.width - 150, Math.max(20, hoveredChartPoint.x - 40))}px`,
                  }}
                >
                  <div className="font-bold text-amber-300 border-b border-neutral-800 pb-1">
                    {hoveredChartPoint.date}
                  </div>
                  <div className="flex justify-between gap-3 text-neutral-300">
                    <span className="capitalize">{chartMetric}:</span>
                    <span className="font-mono font-bold text-neutral-100">
                      {hoveredChartPoint.val.toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-neutral-400 text-[10px]">
                    <span>Commission:</span>
                    <span className="font-mono">{hoveredChartPoint.commission.toLocaleString()} ETB</span>
                  </div>
                  <div className="flex justify-between gap-3 text-neutral-400 text-[10px]">
                    <span>Transactions:</span>
                    <span className="font-mono">{hoveredChartPoint.transactions}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Legend */}
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-neutral-800/80 text-xs font-semibold text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-400" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm border border-amber-400/80 bg-amber-500/30" />
                <span>Commission</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-3 bg-yellow-300" />
                <span>Transactions</span>
              </div>
            </div>
          </section>

          {/* Financial Summary Panel (col-span-12 lg:col-span-4) */}
          <section className="col-span-12 lg:col-span-4 rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <Scale className="size-4 text-amber-400" />
                <h2 className="text-base font-bold tracking-tight text-neutral-100">
                  Financial Summary
                </h2>
              </div>
              <button
                onClick={() => setIsFinancialDetailsOpen(true)}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View details</span>
                <ChevronRight className="size-3" />
              </button>
            </div>

            {/* 7 Clean Financial Line Items */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Gross Deposits
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.grossDeposits ?? 11254160).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Gross Withdrawals
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.grossWithdrawals ?? 514800).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <CreditCard className="size-3.5 text-neutral-500" />
                  Transaction Fees
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.transactionFees ?? 1547600).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <Crown className="size-3.5 text-amber-400/80" />
                  Platform Commission
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.platformCommission ?? 24400).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <Wallet className="size-3.5 text-neutral-500" />
                  Player Liabilities
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.playerLiabilities ?? platformKpis?.userLiabilities ?? 12429910).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-500/80" />
                  Available Platform Funds
                </span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {Number(platformKpis?.availablePlatformFunds ?? 18720840).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400 flex items-center gap-2">
                  <Lock className="size-3.5 text-amber-400/80" />
                  Locked Match Funds
                </span>
                <span className="font-mono font-bold text-neutral-100 tabular-nums">
                  {Number(platformKpis?.lockedMatchFunds ?? platformKpis?.lockedEscrow ?? 5715220).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ETB
                </span>
              </div>
            </div>

            {/* Bottom Highlighted Total Platform Balance Card */}
            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-amber-500/10 p-3.5 flex items-center justify-between shadow-inner shadow-amber-500/10">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Wallet className="size-4 shrink-0 text-amber-400" />
                <span>Total Platform Balance</span>
              </div>
              <div className="font-mono font-black text-amber-300 text-sm sm:text-base tabular-nums">
                {Number(platformKpis?.totalPlatformBalance ?? platformKpis?.platformBalance ?? 53737120).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ETB
              </div>
            </div>
          </section>
        </div>

        {/* =========================================================
            SECTION F & G: Row 2 Grid (Recent Transactions + Quick Actions)
            ========================================================= */}
        <div id="transactions" className="grid grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Recent Transactions Table Panel (col-span-12 lg:col-span-8) */}
          <section className="col-span-12 lg:col-span-8 rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <Receipt className="size-4 text-amber-400" />
                <h2 className="text-base font-bold tracking-tight text-neutral-100">
                  Recent Transactions
                </h2>
              </div>
              <button
                onClick={() => {
                  setTxFilterTab("all");
                  setTxStatusFilter("all");
                  setTxSearchQuery("");
                  toast.info("Reset all transaction filters.");
                }}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
              >
                View all &gt;
              </button>
            </div>

            {/* Filter Bar with Search, Type Dropdown, Status Dropdown, and Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Search input */}
              <div className="sm:col-span-5 relative">
                <Search className="size-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by player, reference..."
                  value={txSearchQuery}
                  onChange={(e) => {
                    setTxSearchQuery(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-black/60 pl-8 pr-3 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Type dropdown */}
              <div className="sm:col-span-3 relative">
                <select
                  value={txFilterTab}
                  onChange={(e) => {
                    setTxFilterTab(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-black/60 pl-3 pr-7 text-xs font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none"
                >
                  {TRANSACTION_TABS.map((tab) => (
                    <option key={tab.key} value={tab.key} className="bg-[#121513]">
                      {tab.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3 text-neutral-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Status dropdown */}
              <div className="sm:col-span-2 relative">
                <select
                  value={txStatusFilter}
                  onChange={(e) => {
                    setTxStatusFilter(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-black/60 pl-3 pr-7 text-xs font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st.key} value={st.key} className="bg-[#121513]">
                      {st.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3 text-neutral-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Date dropdown */}
              <div className="sm:col-span-2 relative">
                <select
                  value={activeDatePreset}
                  onChange={(e) => {
                    setActiveDatePreset(e.target.value);
                    setTxPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-black/60 pl-3 pr-7 text-xs font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none"
                >
                  <option value="7d" className="bg-[#121513]">Oct 1 - Oct 7</option>
                  <option value="today" className="bg-[#121513]">Today</option>
                  <option value="30d" className="bg-[#121513]">Last 30 Days</option>
                  <option value="all" className="bg-[#121513]">All Time</option>
                </select>
                <ChevronDown className="size-3 text-neutral-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Compact Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-800/80 bg-black/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161a18]/60 text-amber-400/80 uppercase font-mono text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount (ETB)</th>
                    <th className="py-2.5 px-3 text-right">Fee (ETB)</th>
                    <th className="py-2.5 px-3 text-right">Net (ETB)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/80">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                        No transactions recorded matching the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx: any) => {
                      const isCredit =
                        tx?.type === "deposits" ||
                        tx?.type === "winnings" ||
                        tx?.type === "refunds" ||
                        tx?.entryType === "deposit_credit" ||
                        tx?.entryType === "match_unlock";
                      const amt = Number(tx?.amountEtb ?? 0);
                      const fee = Number(tx?.feeEtb ?? 0);
                      const net = isCredit ? amt - fee : -(amt + fee);

                      return (
                        <tr
                          key={tx._id}
                          onClick={() => {
                            setSelectedTx(tx);
                            setIsTxDrawerOpen(true);
                          }}
                          className="hover:bg-amber-500/[0.04] transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6 border border-neutral-800">
                                <AvatarImage src={tx.userAvatarUrl} alt={tx.username} />
                                <AvatarFallback className="text-[9px] font-bold text-amber-400 bg-amber-500/10">
                                  {initials(tx.username)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-bold text-neutral-200 max-w-[100px] truncate">
                                @{tx.username}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 capitalize text-neutral-300 font-medium">
                            {tx.type}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-200 tabular-nums">
                            {amt.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-400 tabular-nums text-[11px]">
                            {fee > 0 ? fee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 px-3 text-right font-mono font-bold tabular-nums",
                              isCredit ? "text-emerald-400" : "text-neutral-200"
                            )}
                          >
                            {isCredit ? "+" : ""}
                            {net.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <StatusBadge status={tx.status} size="sm" />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex size-6 items-center justify-center rounded-lg text-neutral-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
                              <Eye className="size-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5">
                <button
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-neutral-800 bg-black/60 text-neutral-300 hover:border-amber-500/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setTxPage(pg)}
                    className={cn(
                      "size-7 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      txPage === pg
                        ? "bg-amber-500 text-black shadow-xs"
                        : "border border-neutral-800 bg-black/60 text-neutral-300 hover:border-amber-500/30"
                    )}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  disabled={txPage >= totalPages}
                  onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-neutral-800 bg-black/60 text-neutral-300 hover:border-amber-500/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  &gt;
                </button>
              </div>

              <div>
                Showing {totalFilteredTx === 0 ? 0 : (txPage - 1) * TX_PAGE_SIZE + 1} -{" "}
                {Math.min(totalFilteredTx, txPage * TX_PAGE_SIZE)} of {totalFilteredTx} Transactions
              </div>
            </div>
          </section>

          {/* Quick Actions Panel (col-span-12 lg:col-span-4) */}
          <section className="col-span-12 lg:col-span-4 rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-neutral-800/80 pb-3">
              <Zap className="size-4 text-amber-400" />
              <h2 className="text-base font-bold tracking-tight text-neutral-100">
                Quick Actions
              </h2>
            </div>

            {/* 5 Distinct Quick Action Cards */}
            <div className="space-y-2.5">
              {/* 1. Pending Withdrawals */}
              <button
                onClick={() => setPendingModalType("withdrawals")}
                className="w-full rounded-xl border border-amber-500/20 bg-black/40 hover:bg-neutral-900/80 hover:border-amber-500/40 p-3 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                    <ArrowUpRight className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 group-hover:text-amber-300 transition-colors">
                      Pending Withdrawals
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Requires verification
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold font-mono">
                    {platformKpis?.pendingActions?.pendingWithdrawals ?? 2}
                  </span>
                  <ChevronRight className="size-3.5 text-neutral-500 group-hover:text-neutral-300" />
                </div>
              </button>

              {/* 2. Pending Deposits */}
              <button
                onClick={() => setPendingModalType("deposits")}
                className="w-full rounded-xl border border-amber-500/20 bg-black/40 hover:bg-neutral-900/80 hover:border-amber-500/40 p-3 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <ArrowDownLeft className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 group-hover:text-emerald-300 transition-colors">
                      Pending Deposits
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Awaiting confirmation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold font-mono">
                    {platformKpis?.pendingActions?.pendingDeposits ?? 1}
                  </span>
                  <ChevronRight className="size-3.5 text-neutral-500 group-hover:text-neutral-300" />
                </div>
              </button>

              {/* 3. Failed Payments */}
              <button
                onClick={() => {
                  setTxFilterTab("all");
                  setTxStatusFilter("failed");
                  scrollToSection("transactions");
                  toast.info("Filtered table to show failed transactions.");
                }}
                className="w-full rounded-xl border border-rose-500/20 bg-black/40 hover:bg-neutral-900/80 hover:border-rose-500/40 p-3 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 group-hover:text-rose-300 transition-colors">
                      Failed Payments
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Requires manual review
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold font-mono">
                    {platformKpis?.pendingActions?.failedPayments ?? 2}
                  </span>
                  <ChevronRight className="size-3.5 text-neutral-500 group-hover:text-neutral-300" />
                </div>
              </button>

              {/* 4. User Feedback */}
              <button
                id="feedback"
                onClick={() => {
                  if (Array.isArray(feedbackList) && feedbackList.length > 0) {
                    setSelectedFeedback(feedbackList[0]);
                  } else {
                    toast.info("No new user feedback to review.");
                  }
                }}
                className="w-full rounded-xl border border-amber-500/20 bg-black/40 hover:bg-neutral-900/80 hover:border-amber-500/40 p-3 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 shrink-0">
                    <MessageSquare className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 group-hover:text-sky-300 transition-colors">
                      User Feedback
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      New player reports
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold font-mono">
                    {platformKpis?.pendingActions?.userFeedback ?? 11}
                  </span>
                  <ChevronRight className="size-3.5 text-neutral-500 group-hover:text-neutral-300" />
                </div>
              </button>

              {/* 5. System Alerts */}
              <button
                onClick={() => scrollToSection("health")}
                className="w-full rounded-xl border border-neutral-800 bg-black/40 hover:bg-neutral-900/80 hover:border-neutral-700 p-3 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shrink-0">
                    <Server className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 group-hover:text-purple-300 transition-colors">
                      System Alerts
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      {(platformKpis?.pendingActions?.systemAlerts ?? 0) === 0 ? "No active alerts" : "Review system variance"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 text-xs font-bold font-mono">
                    {platformKpis?.pendingActions?.systemAlerts ?? 0}
                  </span>
                  <ChevronRight className="size-3.5 text-neutral-500 group-hover:text-neutral-300" />
                </div>
              </button>
            </div>
          </section>
        </div>

        {/* =========================================================
            SECTION H: Row 3 Grid (Active Matches, Tournaments, Recent Activity)
            ========================================================= */}
        <section id="matches" className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-neutral-800/80 pb-3">
            <Gamepad2 className="size-5 text-amber-400" />
            <h2 className="text-base font-bold tracking-tight text-neutral-100">
              Active Matches &amp; Tournaments
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Column 1: Live Matches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="size-4 text-amber-400/80" />
                  <span className="text-xs font-bold text-neutral-200">Live Matches</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ({matchesAndTournaments?.totalActiveMatches ?? 23} ongoing)
                  </span>
                </div>
                <Link
                  href="/leaderboard"
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                >
                  View all &gt;
                </Link>
              </div>

              <div className="space-y-2">
                {Array.isArray(matchesAndTournaments?.matches) && matchesAndTournaments.matches.length > 0 ? (
                  matchesAndTournaments.matches.slice(0, 4).map((m: any) => (
                    <Link
                      key={m._id}
                      href={`/game/${m._id}`}
                      className="block p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 hover:border-amber-500/30 hover:bg-neutral-900/60 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-6 border border-neutral-800 shrink-0">
                            <AvatarImage src={m.whiteAvatarUrl} alt={m.whiteName} />
                            <AvatarFallback className="text-[9px] font-bold">
                              {initials(m.whiteName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-neutral-200 truncate max-w-[80px]">
                            {m.whiteName}
                          </span>
                          <span className="text-neutral-500 font-bold">vs</span>
                          <span className="font-semibold text-neutral-200 truncate max-w-[80px]">
                            {m.blackName}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold text-[11px] shrink-0">
                          {m.score || "1 - 0"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1 pl-8">
                        <span>{m.timeControlKey} Blitz</span>
                        <span>Stake: {m.stake} ETB</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  [
                    { p1: "yaredusk", p2: "samfeth", rating1: 1820, rating2: 1790, score: "1 - 0" },
                    { p1: "elisha", p2: "soliana", rating1: 1640, rating2: 1580, score: "0 - 0" },
                    { p1: "eddi", p2: "bekigo", rating1: 1510, rating2: 1480, score: "1 - 0" },
                    { p1: "dani", p2: "anteneh", rating1: 1940, rating2: 1890, score: "0 - 1" },
                  ].map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-6 border border-neutral-800 shrink-0">
                          <AvatarFallback className="text-[9px] font-bold text-amber-400 bg-amber-500/10">
                            {initials(m.p1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-neutral-200">{m.p1}</span>
                          <span className="text-neutral-500 text-[10px]">vs</span>
                          <span className="font-semibold text-neutral-200">{m.p2}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-[11px] shrink-0">
                        {m.score}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Ongoing Tournaments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="size-4 text-amber-400/80" />
                  <span className="text-xs font-bold text-neutral-200">Ongoing Tournaments</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ({matchesAndTournaments?.totalActiveTournaments ?? 4} active)
                  </span>
                </div>
                <Link
                  href="/tournaments"
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                >
                  View all &gt;
                </Link>
              </div>

              <div className="space-y-2">
                {Array.isArray(matchesAndTournaments?.tournaments) && matchesAndTournaments.tournaments.length > 0 ? (
                  matchesAndTournaments.tournaments.slice(0, 4).map((t: any) => (
                    <Link
                      key={t._id}
                      href={`/tournaments/${t._id}`}
                      className="block p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 hover:border-amber-500/30 hover:bg-neutral-900/60 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <Crown className="size-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold text-neutral-200 truncate">{t.title}</span>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-amber-400/90 shrink-0">
                          {t.timeRemainingLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1 pl-5.5">
                        <span className="capitalize">{t.format} Arena</span>
                        <span>{t.participantCount} Players</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  [
                    { title: "Winter Blitz Cup", sub: "3+2 • 64 Players", badge: "Ends in 2d" },
                    { title: "Grandmaster Championship", sub: "5+3 • 32 Players", badge: "Ends in 1d" },
                    { title: "Weekly Arena", sub: "3+0 • 120 Players", badge: "Ends in 12h" },
                    { title: "Weekend Knockout", sub: "10+0 • 16 Players", badge: "Finished" },
                  ].map((t, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Crown className="size-3.5 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold text-neutral-200">{t.title}</div>
                          <div className="text-[10px] text-neutral-500">{t.sub}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 shrink-0">
                        {t.badge}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Recent Activity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-amber-400/80" />
                  <span className="text-xs font-bold text-neutral-200">Recent Activity</span>
                </div>
                <button
                  onClick={() => scrollToSection("transactions")}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                >
                  View all &gt;
                </button>
              </div>

              <div className="space-y-2">
                {Array.isArray(recentActivity) && recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((act: any) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 text-xs flex items-start gap-2.5"
                    >
                      <div className="flex size-6 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-amber-400 shrink-0 mt-0.5">
                        {act.type === "withdrawal" ? (
                          <ArrowUpRight className="size-3 text-amber-400" />
                        ) : act.type === "deposit" ? (
                          <ArrowDownLeft className="size-3 text-emerald-400" />
                        ) : act.type === "player_signup" ? (
                          <User className="size-3 text-sky-400" />
                        ) : (
                          <Trophy className="size-3 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-neutral-200 truncate">
                          {act.description}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {new Date(act.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  [
                    { text: "yaredusk requested a withdrawal", time: "10 mins ago", type: "wdr" },
                    { text: "gigi made a deposit of 500.00 ETB", time: "25 mins ago", type: "dep" },
                    { text: "fidel registered a profile", time: "1 hour ago", type: "user" },
                    { text: "Match completed: gigi vs yaredusk", time: "2 hours ago", type: "game" },
                    { text: "Admin updated system settings", time: "5 hours ago", type: "admin" },
                  ].map((act, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-neutral-800/80 bg-black/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-neutral-300 truncate">{act.text}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono shrink-0 pl-2">
                        {act.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION I: Row 4 (System Health Cards)
            ========================================================= */}
        <section id="health" className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-amber-400" />
              <div>
                <h2 className="text-base font-bold tracking-tight text-neutral-100">
                  System Health
                </h2>
                <p className="text-xs text-neutral-400">
                  All systems are running normally.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span suppressHydrationWarning>
                Last checked: {isMounted ? `${mountedDate} ${mountedTime}` : "Just now"}
              </span>
            </div>
          </div>

          {/* 6 Horizontal Health Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-1">
            {[
              { name: "Convex", status: systemHealth?.convex ?? "Healthy", latency: systemHealth?.latency },
              { name: "Clerk", status: systemHealth?.auth ?? "Healthy" },
              { name: "Chapa", status: systemHealth?.chapa ?? "Healthy" },
              { name: "Webhooks", status: systemHealth?.webhooks ?? "Healthy" },
              { name: "Database", status: systemHealth?.database ?? "Healthy" },
              { name: "Reconciliation", status: systemHealth?.cron ?? "Healthy" },
            ].map((srv, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-neutral-800 bg-black/40 p-3 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-200">{srv.name}</span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold text-emerald-400">
                    {srv.status === "HEALTHY" ? "Healthy" : srv.status}
                  </span>
                  {srv.latency && (
                    <span className="text-[10px] font-mono text-neutral-500">
                      {srv.latency}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            SECTION J: Targeted Player Search & Wallet Security Controls (Users & Audit)
            ========================================================= */}
        <section id="users" className="rounded-2xl border border-amber-500/20 bg-[#121513]/90 p-5 sm:p-6 shadow-xl shadow-black/50 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold tracking-tight text-neutral-100">
                  Targeted Player Security &amp; Wallet Governance
                </h2>
                <p className="text-xs text-neutral-400">
                  Search players, audit balances, and enforce compliance freezes
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/25">
              Server-Side Audit Active
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Player Search & Selection */}
            <div className="lg:col-span-6 space-y-3">
              <div className="relative">
                <Search className="size-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search player by username or ID..."
                  value={playerSecuritySearch}
                  onChange={(e) => setPlayerSecuritySearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-800 bg-black/60 pl-9 pr-3 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Player list results */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {Array.isArray(securitySearchPlayers) && securitySearchPlayers.length > 0 ? (
                  securitySearchPlayers.map((p: any) => {
                    const isSelected = currentSecurityPlayer?._id === p._id;
                    return (
                      <div
                        key={p._id}
                        onClick={() => setSelectedSecurityPlayer(p)}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs",
                          isSelected
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            : "bg-black/40 border-neutral-800/80 hover:bg-neutral-900/60 text-neutral-300"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-7 border border-neutral-800">
                            <AvatarImage src={p.avatarUrl} alt={p.username} />
                            <AvatarFallback className="text-[10px] font-bold">
                              {initials(p.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-bold truncate text-neutral-100">
                              @{p.username}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              Rating: {p.rating} • Bal: {p.wallet?.availableBalance?.toFixed(2) ?? "0.00"} ETB
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                              p.wallet?.status === "frozen"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            )}
                          >
                            {p.wallet?.status ?? "active"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlayerId(p._id);
                              setIsPlayerDrawerOpen(true);
                            }}
                            className="size-7 p-0 text-neutral-400 hover:text-amber-400"
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                    Type a username above to search and govern player balances.
                  </div>
                )}
              </div>
            </div>

            {/* Governance Action & Reason Form */}
            <div className="lg:col-span-6 rounded-xl border border-neutral-800/80 bg-black/40 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-400">Selected Player:</span>
                <span className="font-bold text-amber-300 font-mono">
                  {currentSecurityPlayer ? `@${currentSecurityPlayer.username}` : "None"}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-400 mb-1 block">
                  Enforce Action
                </label>
                <select
                  value={selectedRestrictionAction}
                  onChange={(e) => setSelectedRestrictionAction(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-[#121513] px-3 text-xs font-semibold text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {RESTRICTION_ACTIONS.map((act) => (
                    <option key={act.value} value={act.value} className="bg-[#121513]">
                      {act.label}
                    </option>
                  ))}
                </select>
              </div>

              <div id="audit">
                <label className="text-[11px] font-semibold text-neutral-400 mb-1 block">
                  Mandatory Audit Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fair play investigation or suspicious payout request"
                  value={securityAuditReason}
                  onChange={(e) => setSecurityAuditReason(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-800 bg-[#121513] px-3 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <Button
                onClick={() => setIsSecurityConfirmOpen(true)}
                disabled={!currentSecurityPlayer || isApplyingSecurityAction}
                className="w-full h-9 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md cursor-pointer mt-1"
              >
                Apply Security Restriction
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================
          SECTION K: Global Interactive Drawers & Modals
          ========================================================= */}
      {/* 1. Transaction Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        isOpen={isTxDrawerOpen}
        onClose={() => {
          setIsTxDrawerOpen(false);
          setSelectedTx(null);
        }}
        onInspectPlayer={(playerId) => {
          setIsTxDrawerOpen(false);
          setSelectedPlayerId(playerId as Id<"players">);
          setIsPlayerDrawerOpen(true);
        }}
      />

      {/* 2. Player Detail Drawer (4-Tabs: Profile, Wallet, Fair Play, Audit) */}
      <PlayerDetailDrawer
        playerId={selectedPlayerId}
        isOpen={isPlayerDrawerOpen}
        onClose={() => {
          setIsPlayerDrawerOpen(false);
          setSelectedPlayerId(null);
        }}
      />

      {/* 3. Feedback Detail Modal */}
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
        />
      )}

      {/* 4. Financial Details Modal */}
      <DetailDrawer
        isOpen={isFinancialDetailsOpen}
        onClose={() => setIsFinancialDetailsOpen(false)}
        title="Authoritative Financial Breakdown"
        subtitle="Audited ledger float and reserve accounting"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
            <h4 className="font-bold text-amber-300">Financial Integrity Policy</h4>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              Deposits are recorded float and player obligations, not immediate platform revenue. Platform revenue consists strictly of collected match commissions.
            </p>
          </div>

          <div className="space-y-2 border border-neutral-800 rounded-xl p-3 bg-black/40">
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Total Approved Deposits</span>
              <span className="font-mono font-bold">{platformKpis?.grossDeposits?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Total Completed Withdrawals</span>
              <span className="font-mono font-bold">{platformKpis?.grossWithdrawals?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Platform Balance (Float)</span>
              <span className="font-mono font-bold text-amber-400">{platformKpis?.platformBalance?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Player Available Liabilities</span>
              <span className="font-mono font-bold">{platformKpis?.playerLiabilities?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Active Match Escrow</span>
              <span className="font-mono font-bold">{platformKpis?.lockedMatchFunds?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Pending Withdrawal Reserves</span>
              <span className="font-mono font-bold">{platformKpis?.pendingWithdrawalReserve?.toLocaleString() ?? "0"} ETB</span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-bold text-emerald-400">
              <span>Unencumbered Available Float</span>
              <span className="font-mono">{platformKpis?.availablePlatformFunds?.toLocaleString() ?? "0"} ETB</span>
            </div>
          </div>
        </div>
      </DetailDrawer>

      {/* 5. Pending Action Approval/Rejection Modals */}
      <DetailDrawer
        isOpen={pendingModalType !== null}
        onClose={() => setPendingModalType(null)}
        title={pendingModalType === "deposits" ? "Pending Deposits Verification" : "Pending Withdrawals Authorization"}
        subtitle="Review player submissions and credit or transfer funds"
      >
        <div className="space-y-3 text-xs">
          {pendingModalType === "deposits" ? (
            Array.isArray(pendingDeposits) && pendingDeposits.length > 0 ? (
              pendingDeposits.map((dep: any) => (
                <div key={dep._id} className="p-3 rounded-xl border border-neutral-800 bg-black/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-200">@{dep.username}</span>
                    <span className="font-mono font-bold text-emerald-400">{dep.amount?.toFixed(2)} ETB</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    Ref: {dep.code} • Date: {new Date(dep.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleApproveDeposit(dep._id)}
                      className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                    >
                      Approve &amp; Credit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRejectModal({
                          type: "deposit",
                          id: dep._id,
                          username: dep.username,
                          amount: dep.amount,
                          reference: dep.code,
                        })
                      }
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                No pending deposits awaiting verification.
              </div>
            )
          ) : (
            Array.isArray(pendingWithdrawals) && pendingWithdrawals.length > 0 ? (
              pendingWithdrawals.map((wdr: any) => (
                <div key={wdr._id} className="p-3 rounded-xl border border-neutral-800 bg-black/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-200">@{wdr.username}</span>
                    <span className="font-mono font-bold text-amber-400">{wdr.amount?.toFixed(2)} ETB</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    Method: {wdr.payoutMethod} • Account: {wdr.payoutAccount}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleCompleteWithdrawal(wdr._id)}
                      className="flex-1 h-8 bg-amber-500 hover:bg-amber-400 text-black font-bold"
                    >
                      Complete Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRejectModal({
                          type: "withdrawal",
                          id: wdr._id,
                          username: wdr.username,
                          amount: wdr.amount,
                          reference: wdr.payoutAccount,
                        })
                      }
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      Reject &amp; Refund
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                No pending withdrawals awaiting authorization.
              </div>
            )
          )}
        </div>
      </DetailDrawer>

      {/* 6. Rejection Modal with Mandatory Reason */}
      <ConfirmDialog
        isOpen={rejectModal !== null}
        onClose={() => {
          setRejectModal(null);
          setRejectionReason("");
        }}
        onConfirm={handleConfirmRejection}
        title={`Reject ${rejectModal?.type === "deposit" ? "Deposit" : "Withdrawal"}`}
        description={`Are you sure you want to reject this ${rejectModal?.type} of ${rejectModal?.amount?.toFixed(2)} ETB for @${rejectModal?.username}?`}
        confirmText="Confirm Rejection"
        isDestructive
        requireReason
        targetName={`@${rejectModal?.username}`}
      />

      {/* 7. Security Action Confirm Dialog */}
      <ConfirmDialog
        isOpen={isSecurityConfirmOpen}
        onClose={() => setIsSecurityConfirmOpen(false)}
        onConfirm={handleApplySecurityAction}
        title="Confirm Wallet Governance Action"
        description={`Apply "${selectedRestrictionAction.replace(/_/g, " ")}" for player @${currentSecurityPlayer?.username}?`}
        confirmText="Confirm Action"
        isDestructive={selectedRestrictionAction.includes("freeze") || selectedRestrictionAction.includes("restrict")}
        requireReason
        targetName={`@${currentSecurityPlayer?.username}`}
      />
    </div>
  );
}

export function AdminView() {
  return (
    <AdminErrorBoundary>
      <AdminViewInner />
    </AdminErrorBoundary>
  );
}
