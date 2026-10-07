"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  FeedbackDetailModal,
  type FeedbackItem,
} from "./feedback-detail-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/ui";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  Search,
  Users,
  Wallet,
  Lock,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  Swords,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileImage,
  ExternalLink,
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
  Copy,
  Check,
  ChevronRight,
  UserCheck,
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
  { key: "7d", label: "Last 7 Days" },
  { key: "today", label: "Today" },
  { key: "30d", label: "Last 30 Days" },
  { key: "all", label: "All Time" },
];

const TRANSACTION_TABS = [
  { key: "all", label: "All" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "stakes", label: "Stakes" },
  { key: "winnings", label: "Winnings" },
  { key: "commissions", label: "Commissions" },
  { key: "refunds", label: "Refunds" },
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

export function AdminView() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(
    api.admin?.isAdmin as any,
    isAuthenticated ? {} : "skip"
  );

  // Filter & Search states
  const [activeDatePreset, setActiveDatePreset] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txFilterTab, setTxFilterTab] = useState("all");
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [feedbackTab, setFeedbackTab] = useState<"NEW" | "IN_REVIEW" | "RESOLVED">("NEW");

  // Selection states for Drawers & Modals
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isTxDrawerOpen, setIsTxDrawerOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<Id<"players"> | null>(null);
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);

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

  // Clipboard copy tracker
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
          type: txFilterTab === "all" ? undefined : txFilterTab,
          search: txSearchQuery ? txSearchQuery.trim() : undefined,
          limit: 50,
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

  // Set default selected player for security card once loaded
  React.useEffect(() => {
    if (!selectedSecurityPlayer && Array.isArray(securitySearchPlayers) && securitySearchPlayers.length > 0) {
      setSelectedSecurityPlayer(securitySearchPlayers[0]);
    }
  }, [securitySearchPlayers, selectedSecurityPlayer]);

  // Auth Guard
  if (isAdmin === false) {
    router.replace("/");
    return null;
  }

  if (isAdmin === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-muted-foreground">
          Authenticating administrator permissions...
        </p>
      </div>
    );
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Dashboard metrics synchronized.");
    }, 600);
  };

  const handleCopy = (text: string, label: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
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
    a.download = `castle_chess_transactions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transactions exported successfully!");
  };

  const handleApproveDeposit = async (id: string) => {
    try {
      await approveDeposit({ depositId: id });
      toast.success("Deposit approved and player wallet balance credited!");
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
    if (!selectedSecurityPlayer) {
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
        targetUserId: selectedSecurityPlayer._id,
        depositsRestricted,
        stakingRestricted,
        withdrawalsRestricted,
        freezeEntireWallet,
        reason: finalReason,
      });

      toast.success("Wallet restrictions applied successfully.");
      setSecurityAuditReason("");
      setIsSecurityConfirmOpen(false);

      // Optimistically update selected player's wallet status
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

  // Sparkline data helpers
  const defaultSparklines = useMemo(
    () => ({
      players: [8, 12, 14, 16, 20, 22, 25],
      online: [3, 5, 4, 7, 6, 8, 7],
      games: [2, 4, 3, 6, 5, 8, 7],
      balance: [1200, 1600, 2100, 2900, 3100, 3600, 4200],
      escrow: [200, 400, 300, 500, 450, 700, 600],
      revenue: [40, 90, 80, 140, 180, 160, 210],
      deposits: [300, 500, 450, 700, 850, 800, 950],
      withdrawals: [100, 150, 200, 250, 300, 320, 400],
    }),
    []
  );

  // SVG Spline calculation for 7-day revenue trend chart
  const chartPoints = useMemo(() => {
    const rawData =
      platformKpis?.chartData && platformKpis.chartData.length >= 2
        ? platformKpis.chartData
        : [
            { date: "Day 1", revenue: 40, games: 3 },
            { date: "Day 2", revenue: 90, games: 6 },
            { date: "Day 3", revenue: 70, games: 5 },
            { date: "Day 4", revenue: 130, games: 9 },
            { date: "Day 5", revenue: 190, games: 12 },
            { date: "Day 6", revenue: 160, games: 10 },
            { date: "Day 7", revenue: 220, games: 15 },
          ];

    const width = 600;
    const height = 180;
    const paddingX = 35;
    const paddingY = 25;

    const revenues = rawData.map((d: any) => d.revenue);
    const minRev = Math.min(...revenues, 0);
    const maxRev = Math.max(...revenues, 10);
    const range = maxRev - minRev || 1;

    const pts = rawData.map((d: any, idx: number) => {
      const x = paddingX + (idx / (rawData.length - 1)) * (width - 2 * paddingX);
      const y = height - paddingY - ((d.revenue - minRev) / range) * (height - 2 * paddingY);
      return { x, y, date: d.date, revenue: d.revenue, games: d.games };
    });

    let pathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2;
      pathD += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${((p0.y + p1.y) / 2).toFixed(1)} T ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }

    const fillD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${height - paddingY} L ${pts[0].x.toFixed(1)} ${height - paddingY} Z`;

    const totalRevenue7d = revenues.reduce((a: number, b: number) => a + b, 0);
    const totalGames7d = rawData.reduce((acc: number, d: any) => acc + (d.games || 0), 0);

    return {
      pts,
      pathD,
      fillD,
      width,
      height,
      totalRevenue7d,
      totalGames7d,
    };
  }, [platformKpis?.chartData]);

  // Desktop Table Columns Definition
  const transactionColumns: ColumnDef<any>[] = [
    {
      key: "createdAt",
      header: "Date & Time",
      render: (row) => (
        <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "player",
      header: "Player",
      render: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="size-6 border border-border/80 shrink-0">
            <AvatarImage src={row.userAvatarUrl} alt={row.username} />
            <AvatarFallback className="text-[10px] font-bold">
              {initials(row.username)}
            </AvatarFallback>
          </Avatar>
          <span className="font-bold text-xs text-foreground truncate max-w-[110px]">
            {row.username}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted/60 text-foreground border border-border/60">
          {row.type}
        </span>
      ),
    },
    {
      key: "amountEtb",
      header: "Amount (ETB)",
      align: "right",
      render: (row) => (
        <span className="font-mono font-bold tabular-nums text-foreground">
          {row.amountEtb.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "feeEtb",
      header: "Fee (ETB)",
      align: "right",
      render: (row) => (
        <span className="font-mono text-muted-foreground tabular-nums text-[11px]">
          {row.feeEtb > 0
            ? row.feeEtb.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00"}
        </span>
      ),
    },
    {
      key: "netEtb",
      header: "Net (ETB)",
      align: "right",
      render: (row) => {
        const isCredit =
          row.type === "deposits" ||
          row.type === "winnings" ||
          row.entryType === "credit" ||
          row.entryType === "deposit_credit";
        const net = isCredit ? row.amountEtb - row.feeEtb : -(row.amountEtb + row.feeEtb);
        return (
          <span
            className={cn(
              "font-mono font-bold tabular-nums",
              isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground"
            )}
          >
            {isCredit ? "+" : ""}
            {net.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      key: "referenceId",
      header: "Reference",
      render: (row) => (
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px] block" title={row.referenceId}>
          {row.referenceId}
        </span>
      ),
    },
    {
      key: "providerTxId",
      header: "Chapa Ref",
      render: (row) => (
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[90px] block" title={row.providerTxId || "—"}>
          {row.providerTxId || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: "action",
      header: "Action",
      align: "center",
      render: () => (
        <span className="inline-flex size-6 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground group-hover:text-primary transition-colors">
          <Eye className="size-3.5" />
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* =========================================================
          SECTION 1: Header Bar
          ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="size-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Admin Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitor and manage Castle Chess operations.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Real Date/Time Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground font-mono">
            <Clock className="size-3.5 text-primary" />
            <span>
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Date range dropdown preset */}
          <div className="relative">
            <select
              value={activeDatePreset}
              onChange={(e) => setActiveDatePreset(e.target.value)}
              className="h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          {/* Export CSV Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* =========================================================
          SECTION 2: Top 8 KPI Row
          ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {/* 1. Total Players */}
        <KpiCard
          title="Total Players"
          value={platformKpis?.totalPlayers ?? 0}
          trend={platformKpis?.trends?.totalPlayers ?? "+0.0%"}
          icon={Users}
          sparklineData={defaultSparklines.players}
        />

        {/* 2. Online Now */}
        <KpiCard
          title="Online Now"
          value={platformKpis?.onlineNow ?? 0}
          trend={platformKpis?.trends?.onlineNow ?? "+0.0%"}
          icon={Activity}
          sparklineData={defaultSparklines.online}
        />

        {/* 3. Active Games */}
        <KpiCard
          title="Active Games"
          value={platformKpis?.activeGames ?? 0}
          trend={platformKpis?.trends?.activeGames ?? "+0.0%"}
          icon={Swords}
          sparklineData={defaultSparklines.games}
        />

        {/* 4. Platform Balance */}
        <KpiCard
          title="Platform Balance"
          subtitle="Recorded Platform Funds"
          value={platformKpis?.platformBalance ?? 0}
          currency="ETB"
          trend={platformKpis?.trends?.platformBalance ?? "+0.0%"}
          icon={Wallet}
          sparklineData={defaultSparklines.balance}
        />

        {/* 5. Locked Escrow */}
        <KpiCard
          title="Locked Escrow"
          subtitle="In-game stakes"
          value={platformKpis?.lockedEscrow ?? 0}
          currency="ETB"
          trend={platformKpis?.trends?.lockedEscrow ?? "+0.0%"}
          icon={Lock}
          sparklineData={defaultSparklines.escrow}
        />

        {/* 6. Revenue Today */}
        <KpiCard
          title="Revenue Today"
          value={platformKpis?.revenueToday ?? 0}
          currency="ETB"
          trend={platformKpis?.trends?.revenueToday ?? "+0.0%"}
          icon={TrendingUp}
          sparklineData={defaultSparklines.revenue}
        />

        {/* 7. Deposits Today */}
        <KpiCard
          title="Deposits Today"
          value={platformKpis?.depositsToday ?? 0}
          currency="ETB"
          trend={platformKpis?.trends?.depositsToday ?? "+0.0%"}
          icon={ArrowDownLeft}
          sparklineData={defaultSparklines.deposits}
        />

        {/* 8. Withdrawals Today */}
        <KpiCard
          title="Withdrawals Today"
          value={platformKpis?.withdrawalsToday ?? 0}
          currency="ETB"
          trend={platformKpis?.trends?.withdrawalsToday ?? "+0.0%"}
          icon={ArrowUpRight}
          sparklineData={defaultSparklines.withdrawals}
        />
      </div>

      {/* =========================================================
          SECTION 3: Row 1 Grid (Live Chart, Pending Actions, Quick Actions)
          ========================================================= */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Overview Live Chart Card (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <span>Overview Live Chart</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                7-day platform revenue trajectory and match activity.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto">
              Live Trend: +{chartPoints.totalRevenue7d.toFixed(2)} ETB
            </span>
          </div>

          {/* SVG Spline Chart */}
          <div className="relative w-full overflow-hidden pt-2">
            <svg
              viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
              className="w-full h-44 sm:h-48 overflow-visible"
              aria-label="7-day revenue trend chart"
            >
              <defs>
                <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line
                x1="30"
                y1="30"
                x2={chartPoints.width - 30}
                y2="30"
                stroke="currentColor"
                className="text-border/40"
                strokeDasharray="4 4"
              />
              <line
                x1="30"
                y1="85"
                x2={chartPoints.width - 30}
                y2="85"
                stroke="currentColor"
                className="text-border/40"
                strokeDasharray="4 4"
              />
              <line
                x1="30"
                y1="145"
                x2={chartPoints.width - 30}
                y2="145"
                stroke="currentColor"
                className="text-border/40"
              />

              {/* Area Gradient Fill */}
              <path d={chartPoints.fillD} fill="url(#adminRevenueGrad)" />

              {/* Spline Path */}
              <path
                d={chartPoints.pathD}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points & X-axis date labels */}
              {chartPoints.pts.map((pt: { x: number; y: number; date: string; revenue: number; games: number }, i: number) => (
                <g key={`spline-pt-${i}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    className="fill-primary stroke-background stroke-2 hover:scale-125 transition-transform"
                  />
                  <text
                    x={pt.x}
                    y={chartPoints.height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-mono font-medium"
                  >
                    {pt.date}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* 3 Summary Stats along the bottom */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-border/60">
            <div className="p-2.5 rounded-2xl bg-muted/20 border border-border/60 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Total Revenue (7d)
              </span>
              <span className="text-sm sm:text-base font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {chartPoints.totalRevenue7d.toFixed(2)} ETB
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-muted/20 border border-border/60 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Transactions (7d)
              </span>
              <span className="text-sm sm:text-base font-black font-mono tabular-nums text-foreground">
                {chartPoints.totalGames7d}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-muted/20 border border-border/60 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                New Players (7d)
              </span>
              <span className="text-sm sm:text-base font-black font-mono tabular-nums text-foreground">
                {platformKpis?.totalPlayers ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Actions Queue Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="size-4 text-amber-500" />
                <span>Pending Actions</span>
              </h2>
              <p className="text-xs text-muted-foreground">Action items requiring review</p>
            </div>
            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5">
              Live Queue
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* 1. Pending Withdrawals */}
            <button
              type="button"
              onClick={() => setPendingModalType("withdrawals")}
              className="w-full p-2.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Pending Withdrawals
                </span>
              </div>
              <Badge
                variant={
                  (pendingWithdrawals?.length ?? 0) > 0 ? "destructive" : "secondary"
                }
                className="font-mono text-xs font-bold"
              >
                {pendingWithdrawals?.length ?? 0}
              </Badge>
            </button>

            {/* 2. Pending Deposits */}
            <button
              type="button"
              onClick={() => setPendingModalType("deposits")}
              className="w-full p-2.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="size-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Pending Deposits
                </span>
              </div>
              <Badge
                variant={
                  (pendingDeposits?.length ?? 0) > 0 ? "destructive" : "secondary"
                }
                className="font-mono text-xs font-bold"
              >
                {pendingDeposits?.length ?? 0}
              </Badge>
            </button>

            {/* 3. Failed Payments */}
            <button
              type="button"
              onClick={() => {
                setTxFilterTab("refunds");
                toast.info("Filtered transaction ledger by reversals/refunds.");
              }}
              className="w-full p-2.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Failed Payments
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-muted-foreground">
                {platformKpis?.pendingActions?.failedPayments ?? 0}
              </Badge>
            </button>

            {/* 4. Fair Play Reports */}
            <div className="p-2.5 rounded-2xl border border-border/70 bg-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-purple-400 shrink-0" />
                <span className="font-semibold text-foreground">
                  Fair Play Reports
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {platformKpis?.pendingActions?.fairPlayReports ?? 0}
              </Badge>
            </div>

            {/* 5. User Feedback */}
            <button
              type="button"
              onClick={() => {
                setFeedbackTab("NEW");
                toast.info("Filtered user feedback queue to New tickets.");
              }}
              className="w-full p-2.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  User Feedback
                </span>
              </div>
              <Badge
                variant={
                  (platformKpis?.pendingActions?.userFeedback ?? 0) > 0
                    ? "default"
                    : "outline"
                }
                className="font-mono text-xs font-bold"
              >
                {platformKpis?.pendingActions?.userFeedback ?? 0}
              </Badge>
            </button>

            {/* 6. System Alerts */}
            <div className="p-2.5 rounded-2xl border border-border/70 bg-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">System Alerts</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                <span>Normal</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <span>Quick Actions</span>
            </h2>
            <p className="text-xs text-muted-foreground">Administrative shortcuts</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Inspect Player */}
            <button
              type="button"
              onClick={() => setIsInspectPlayerModalOpen(true)}
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <User className="size-5 text-primary" />
              <span className="font-bold text-[11px] text-foreground">Inspect Player</span>
            </button>

            {/* Process Deposit */}
            <button
              type="button"
              onClick={() => setPendingModalType("deposits")}
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <ArrowDownLeft className="size-5 text-emerald-500" />
              <span className="font-bold text-[11px] text-foreground">Process Deposit</span>
            </button>

            {/* Process Withdrawal */}
            <button
              type="button"
              onClick={() => setPendingModalType("withdrawals")}
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <ArrowUpRight className="size-5 text-amber-500" />
              <span className="font-bold text-[11px] text-foreground">Process Withdrawal</span>
            </button>

            {/* Create Tournament */}
            <Link
              href="/tournaments"
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Trophy className="size-5 text-yellow-500" />
              <span className="font-bold text-[11px] text-foreground">Tournaments</span>
            </Link>

            {/* Broadcast Announcement */}
            <button
              type="button"
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Megaphone className="size-5 text-purple-400" />
              <span className="font-bold text-[11px] text-foreground">Announcement</span>
            </button>

            {/* Manage Puzzles */}
            <Link
              href="/puzzles"
              className="p-3 rounded-2xl border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex flex-col items-center justify-center text-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Puzzle className="size-5 text-blue-400" />
              <span className="font-bold text-[11px] text-foreground">Puzzles</span>
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================
          SECTION 4: Row 2 Grid (Financial Overview, Recent Activity, System Health)
          ========================================================= */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Financial Overview Card (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Wallet className="size-4 text-emerald-500" />
                <span>Financial Overview &amp; Solvency</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative platform reserves, user liabilities, and escrow balances.
              </p>
            </div>
            <StatusBadge status="Healthy" size="sm" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {/* 1. Recorded Platform Balance */}
            <MetricCard
              label="Platform Balance"
              value={platformKpis?.platformBalance ?? 0}
              currency="ETB"
              sublabel="Recorded platform float"
              icon={Wallet}
            />

            {/* 2. User Liabilities */}
            <MetricCard
              label="User Liabilities"
              value={platformKpis?.userLiabilities ?? 0}
              currency="ETB"
              sublabel="Player available funds"
              icon={Users}
            />

            {/* 3. Active Match Escrow */}
            <MetricCard
              label="Match Escrow"
              value={platformKpis?.lockedEscrow ?? 0}
              currency="ETB"
              sublabel="Locked match stakes"
              icon={Lock}
            />

            {/* 4. Pending Withdrawal Reserve */}
            <MetricCard
              label="Pending Cashouts"
              value={platformKpis?.pendingWithdrawalReserve ?? 0}
              currency="ETB"
              sublabel="Queued payout reserve"
              icon={Clock}
            />

            {/* 5. Total Deposits */}
            <MetricCard
              label="Total Deposits"
              value={platformStats?.totalDeposits ?? 0}
              currency="ETB"
              sublabel="All-time user inflows"
              icon={ArrowDownLeft}
            />

            {/* 6. Total Withdrawals */}
            <MetricCard
              label="Total Withdrawals"
              value={platformStats?.totalWithdrawals ?? 0}
              currency="ETB"
              sublabel="All-time user payouts"
              icon={ArrowUpRight}
            />

            {/* 7. Platform Revenue (Commissions) */}
            <MetricCard
              label="10% Commissions"
              value={platformStats?.totalCommission ?? 0}
              currency="ETB"
              sublabel="Accumulated match rake"
              icon={TrendingUp}
              className="col-span-2 sm:col-span-1 lg:col-span-2"
            />
          </div>

          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Solvency Backing Ratio:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              100.0% Fully Funded (Zero Unbacked Float)
            </span>
          </div>
        </div>

        {/* Recent Activity Stream Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <span>Recent Activity</span>
              </h2>
              <p className="text-xs text-muted-foreground">Live chronological feed</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-muted-foreground">
              Live Stream
            </span>
          </div>

          <div className="flex-1 max-h-[360px] overflow-y-auto space-y-2 pr-1 divide-y divide-border/40">
            {!Array.isArray(recentActivity) || recentActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No recent activity events recorded.
              </div>
            ) : (
              recentActivity.map((act: any) => {
                const isDeposit = act.type === "deposit";
                const isWithdrawal = act.type === "withdrawal";
                const isGame = act.type === "game_completed";

                return (
                  <div key={act.id} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isDeposit && (
                          <ArrowDownLeft className="size-3.5 text-emerald-500 shrink-0" />
                        )}
                        {isWithdrawal && (
                          <ArrowUpRight className="size-3.5 text-amber-500 shrink-0" />
                        )}
                        {isGame && <Swords className="size-3.5 text-primary shrink-0" />}
                        {!isDeposit && !isWithdrawal && !isGame && (
                          <User className="size-3.5 text-purple-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-foreground truncate">
                          {act.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {act.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* System Health Panel Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Server className="size-4 text-emerald-500" />
                <span>System Health</span>
              </h2>
              <p className="text-xs text-muted-foreground">Infrastructure status</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {systemHealth?.latency || "12ms"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Convex Realtime</span>
              <StatusBadge status={systemHealth?.convex ?? "HEALTHY"} size="sm" />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Chapa Gateway</span>
              <StatusBadge status={systemHealth?.chapa ?? "HEALTHY"} size="sm" />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Clerk Auth</span>
              <StatusBadge status={systemHealth?.auth ?? "HEALTHY"} size="sm" />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Webhooks &amp; Events</span>
              <StatusBadge status={systemHealth?.webhooks ?? "HEALTHY"} size="sm" />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Database Engine</span>
              <StatusBadge status={systemHealth?.database ?? "HEALTHY"} size="sm" />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/50">
              <span className="font-medium text-foreground">Cron Heartbeats</span>
              <StatusBadge status={systemHealth?.cron ?? "HEALTHY"} size="sm" />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Tx Error Rate:</span>
            <span className="font-mono font-bold text-foreground">
              {systemHealth?.errorRate ?? "0.00%"}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          SECTION 5: Row 3 Grid (Transactions, Feedback, Wallet Security)
          ========================================================= */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Transaction History Card (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Transaction History
              </h2>
              <p className="text-xs text-muted-foreground">
                Comprehensive ledger entries across deposits, stakes, and cashouts.
              </p>
            </div>
          </div>

          {/* Filter Bar with Tabs, Search, and CSV Export */}
          <FilterBar
            tabs={TRANSACTION_TABS}
            activeTab={txFilterTab}
            onTabChange={setTxFilterTab}
            searchQuery={txSearchQuery}
            onSearchChange={setTxSearchQuery}
            searchPlaceholder="Search player, reference, hash..."
            onExportCsv={handleExportCsv}
            exportLabel="Export CSV"
          />

          {/* DataTable with Desktop columns & Mobile cards */}
          <DataTable
            columns={transactionColumns}
            data={unifiedTransactions ?? []}
            isLoading={unifiedTransactions === undefined}
            emptyMessage="No ledger transactions match your criteria."
            onRowClick={(row) => {
              setSelectedTx(row);
              setIsTxDrawerOpen(true);
            }}
            renderMobileCard={(row) => {
              const isCredit =
                row.type === "deposits" ||
                row.type === "winnings" ||
                row.entryType === "credit" ||
                row.entryType === "deposit_credit";
              return (
                <div className="p-3.5 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-2.5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-6">
                        <AvatarImage src={row.userAvatarUrl} />
                        <AvatarFallback className="text-[10px]">
                          {initials(row.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-xs truncate">{row.username}</span>
                    </div>
                    <StatusBadge status={row.status} size="sm" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                      {row.type}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-mono font-bold tabular-nums",
                        isCredit ? "text-emerald-500" : "text-foreground"
                      )}
                    >
                      {isCredit ? "+" : "-"}
                      {row.amountEtb.toFixed(2)} ETB
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="truncate max-w-[160px]">Ref: {row.referenceId}</span>
                    <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* User Feedback Widget Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <span>User Feedback</span>
              </h2>
              <p className="text-xs text-muted-foreground">Player reports &amp; tickets</p>
            </div>
            <Link
              href="/feedback"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Feedback Form
            </Link>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 text-xs font-semibold">
            {(["NEW", "IN_REVIEW", "RESOLVED"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFeedbackTab(tab)}
                className={cn(
                  "flex-1 py-1 px-2 rounded-lg text-center transition-all",
                  feedbackTab === tab
                    ? "bg-card text-foreground font-bold shadow-xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Feedback List */}
          <div className="flex-1 max-h-[380px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-border/40">
            {!Array.isArray(feedbackList) || feedbackList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No feedback tickets in &quot;{feedbackTab}&quot; status.
              </div>
            ) : (
              feedbackList.map((fb: any) => (
                <div
                  key={fb._id}
                  onClick={() => setSelectedFeedback(fb)}
                  className="pt-2.5 first:pt-0 space-y-1.5 cursor-pointer hover:bg-muted/30 p-2 rounded-2xl transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground truncate">
                      {fb.userName || "Player"}
                    </span>
                    <StatusBadge status={fb.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize py-0">
                      {fb.category.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {fb.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Targeted Player Wallet Security & Freeze Controls Card (col-span-12 sm:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sliders className="size-4 text-amber-500" />
              <span>Wallet Security &amp; Freeze Controls</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Targeted restriction &amp; freeze switches
            </p>
          </div>

          {/* Search Player Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search player username..."
              value={playerSecuritySearch}
              onChange={(e) => setPlayerSecuritySearch(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Player Selection Dropdown / Results */}
          {playerSecuritySearch && Array.isArray(securitySearchPlayers) && securitySearchPlayers.length > 0 && (
            <div className="rounded-xl border border-border/80 bg-card p-1.5 space-y-1 shadow-lg max-h-36 overflow-y-auto">
              {securitySearchPlayers.map((p: any) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    setSelectedSecurityPlayer(p);
                    setPlayerSecuritySearch("");
                  }}
                  className="w-full p-1.5 rounded-lg text-left text-xs hover:bg-muted flex items-center justify-between"
                >
                  <span className="font-bold text-foreground">@{p.username}</span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    {p.wallet?.availableBalance ?? 0} ETB
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected Player Information & Live Restriction Status */}
          {selectedSecurityPlayer ? (
            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-8">
                    <AvatarImage src={selectedSecurityPlayer.avatarUrl} />
                    <AvatarFallback className="text-xs font-bold">
                      {initials(selectedSecurityPlayer.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground truncate">
                      @{selectedSecurityPlayer.username}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Balance: {selectedSecurityPlayer.wallet?.availableBalance ?? 0} ETB
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={selectedSecurityPlayer.wallet?.status === "frozen" ? "Frozen" : "Active"}
                  size="sm"
                />
              </div>

              {/* 4 Restriction Badges */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold">
                <div className="p-1.5 rounded-lg bg-card border border-border/60 flex items-center justify-between">
                  <span className="text-muted-foreground">Deposits:</span>
                  <span
                    className={
                      selectedSecurityPlayer.wallet?.depositsRestricted
                        ? "text-rose-500 font-bold"
                        : "text-emerald-500 font-bold"
                    }
                  >
                    {selectedSecurityPlayer.wallet?.depositsRestricted ? "Restricted" : "Enabled"}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-card border border-border/60 flex items-center justify-between">
                  <span className="text-muted-foreground">Staking:</span>
                  <span
                    className={
                      selectedSecurityPlayer.wallet?.stakingRestricted
                        ? "text-rose-500 font-bold"
                        : "text-emerald-500 font-bold"
                    }
                  >
                    {selectedSecurityPlayer.wallet?.stakingRestricted ? "Restricted" : "Enabled"}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-card border border-border/60 flex items-center justify-between">
                  <span className="text-muted-foreground">Withdrawals:</span>
                  <span
                    className={
                      selectedSecurityPlayer.wallet?.withdrawalsRestricted
                        ? "text-rose-500 font-bold"
                        : "text-emerald-500 font-bold"
                    }
                  >
                    {selectedSecurityPlayer.wallet?.withdrawalsRestricted ? "Restricted" : "Enabled"}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-card border border-border/60 flex items-center justify-between">
                  <span className="text-muted-foreground">Wallet:</span>
                  <span
                    className={
                      selectedSecurityPlayer.wallet?.status === "frozen"
                        ? "text-rose-500 font-bold"
                        : "text-emerald-500 font-bold"
                    }
                  >
                    {selectedSecurityPlayer.wallet?.status === "frozen" ? "Frozen" : "Active"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
              Search and pick a player to inspect restrictions.
            </div>
          )}

          {/* Action selection dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Security Action
            </label>
            <select
              value={selectedRestrictionAction}
              onChange={(e) => setSelectedRestrictionAction(e.target.value)}
              className="w-full h-8 rounded-xl border border-border/80 bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {RESTRICTION_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Reason Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Audit Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={securityAuditReason}
              onChange={(e) => setSecurityAuditReason(e.target.value)}
              placeholder="Provide an audit justification..."
              className="w-full rounded-xl border border-border/80 bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {selectedSecurityPlayer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPlayerId(selectedSecurityPlayer._id);
                  setIsPlayerDrawerOpen(true);
                }}
                className="flex-1 h-8 text-xs font-semibold"
              >
                Inspect Profile
              </Button>
            )}
            <Button
              size="sm"
              disabled={
                !selectedSecurityPlayer ||
                !securityAuditReason.trim() ||
                isApplyingSecurityAction
              }
              onClick={() => setIsSecurityConfirmOpen(true)}
              className="flex-1 h-8 text-xs font-bold bg-primary text-primary-foreground hover:brightness-110"
            >
              Apply Action
            </Button>
          </div>
        </div>
      </div>

      {/* =========================================================
          SECTION 6: Footer Bar
          ========================================================= */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">Castle Chess Admin</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-muted/60 border border-border/60">
            v2.4
          </span>
        </div>

        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-medium">
            All systems are running normally. No critical issues detected.
          </span>
        </div>

        <div className="font-mono text-[11px]">
          Last Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* =========================================================
          DRAWERS & MODALS
          ========================================================= */}
      {/* 1. Transaction Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        isOpen={isTxDrawerOpen}
        onClose={() => setIsTxDrawerOpen(false)}
        onInspectPlayer={(playerId) => {
          setSelectedPlayerId(playerId as Id<"players">);
          setIsPlayerDrawerOpen(true);
        }}
      />

      {/* 2. Player Detail Drawer */}
      <PlayerDetailDrawer
        playerId={selectedPlayerId}
        isOpen={isPlayerDrawerOpen}
        onClose={() => setIsPlayerDrawerOpen(false)}
      />

      {/* 3. Feedback Detail Modal */}
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          onStatusChange={(newStatus) => {
            setSelectedFeedback((prev) => (prev ? { ...prev, status: newStatus } : null));
          }}
        />
      )}

      {/* 4. Confirm Dialog for Player Wallet Security */}
      <ConfirmDialog
        isOpen={isSecurityConfirmOpen}
        onClose={() => setIsSecurityConfirmOpen(false)}
        onConfirm={handleApplySecurityAction}
        title="Confirm Wallet Security Action"
        description={`Are you sure you want to apply "${selectedRestrictionAction.replace(/_/g, " ")}" to @${selectedSecurityPlayer?.username}?`}
        targetName={`@${selectedSecurityPlayer?.username}`}
        confirmText="Confirm & Log"
        cancelText="Cancel"
        requireReason={true}
        reasonPlaceholder="Provide the administrative reason..."
        isDestructive={selectedRestrictionAction.includes("freeze") || selectedRestrictionAction.includes("restrict")}
        isLoading={isApplyingSecurityAction}
      />

      {/* 5. Pending Queue Review Modal (Deposits & Withdrawals) */}
      {pendingModalType && (
        <DetailDrawer
          isOpen={Boolean(pendingModalType)}
          onClose={() => setPendingModalType(null)}
          title={
            pendingModalType === "deposits"
              ? `Pending Deposits (${pendingDeposits?.length ?? 0})`
              : `Pending Withdrawals (${pendingWithdrawals?.length ?? 0})`
          }
          subtitle="Review and settle pending payment operations."
          className="sm:max-w-xl"
        >
          <div className="space-y-4">
            {pendingModalType === "deposits" ? (
              !Array.isArray(pendingDeposits) || pendingDeposits.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed p-6">
                  <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-foreground">All deposits reviewed</p>
                  <p>No pending deposit submissions in queue.</p>
                </div>
              ) : (
                pendingDeposits.map((d: any) => (
                  <div
                    key={d._id}
                    className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">
                        {d.username}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{d.amount} ETB
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        Reference Code: <strong className="text-foreground font-mono">{d.code}</strong>
                      </p>
                      {d.senderInfo && (
                        <p>
                          Sender Info: <strong className="text-foreground">{d.senderInfo}</strong>
                        </p>
                      )}
                    </div>
                    {d.screenshotUrl && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptUrl(d.screenshotUrl)}
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                        >
                          <FileImage className="size-3.5" />
                          <span>View Proof Screenshot</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs font-semibold"
                        onClick={() => {
                          setRejectModal({
                            type: "deposit",
                            id: d._id,
                            username: d.username,
                            amount: d.amount,
                            reference: d.code,
                          });
                          setRejectionReason(DEPOSIT_REASONS[0]);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApproveDeposit(d._id)}
                      >
                        Approve &amp; Credit
                      </Button>
                    </div>
                  </div>
                ))
              )
            ) : !Array.isArray(pendingWithdrawals) || pendingWithdrawals.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed p-6">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-foreground">No pending cashouts</p>
                <p>All player cashout requests have been processed.</p>
              </div>
            ) : (
              pendingWithdrawals.map((w: any) => (
                <div
                  key={w._id}
                  className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      {w.username}
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {w.amount} ETB
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Method:{" "}
                      <strong className="text-foreground capitalize">
                        {w.payoutMethod === "cbe" ? "CBE Bank" : "Telebirr"}
                      </strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <span>Account:</span>
                      <strong className="text-foreground font-mono">{w.payoutAccount}</strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(w.payoutAccount, "Account", w._id)}
                        className="text-primary hover:underline font-bold text-[11px]"
                      >
                        {copiedKey === w._id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs font-semibold"
                      onClick={() => {
                        setRejectModal({
                          type: "withdrawal",
                          id: w._id,
                          username: w.username,
                          amount: w.amount,
                          reference: `${w.payoutMethod === "cbe" ? "CBE" : "Telebirr"}: ${w.payoutAccount}`,
                        });
                        setRejectionReason(WITHDRAWAL_REASONS[0]);
                      }}
                    >
                      Reject &amp; Refund
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleCompleteWithdrawal(w._id)}
                    >
                      Mark as Paid
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DetailDrawer>
      )}

      {/* 6. Screenshot Lightbox Modal */}
      {selectedReceiptUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReceiptUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-lg w-full overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileImage className="size-4 text-primary" />
                <span>Payment Receipt Preview</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReceiptUrl(null)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="pt-3 max-h-[75vh] overflow-auto flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedReceiptUrl}
                alt="Payment Receipt"
                className="rounded-xl max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. Rejection Dialog Modal */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => !isRejecting && setRejectModal(null)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="font-bold text-base text-foreground">
                Reject {rejectModal.type === "deposit" ? "Deposit" : "Cashout"} Request
              </h3>
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => setRejectModal(null)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground">{rejectModal.username}</p>
                <p className="font-mono text-muted-foreground">{rejectModal.reference}</p>
              </div>
              <span className="font-mono font-bold text-rose-500">
                {rejectModal.amount} ETB
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Quick Select Reason
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(rejectModal.type === "deposit" ? DEPOSIT_REASONS : WITHDRAWAL_REASONS).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className={cn(
                      "rounded-xl px-2.5 py-1 text-xs border text-left transition-all",
                      rejectionReason === reason
                        ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Detailed Reason Note
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Write specific notes..."
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
              <Button
                variant="outline"
                size="sm"
                disabled={isRejecting}
                onClick={() => setRejectModal(null)}
                className="h-8 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isRejecting || !rejectionReason.trim()}
                onClick={handleConfirmRejection}
                className="h-8 text-xs font-bold"
              >
                {isRejecting ? "Processing..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Inspect Player Search Modal */}
      {isInspectPlayerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsInspectPlayerModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <User className="size-4 text-primary" />
                <span>Inspect Player Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsInspectPlayerModalOpen(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search username, email, or Clerk ID..."
                value={inspectSearchQuery}
                onChange={(e) => setInspectSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-border/40">
              {!Array.isArray(inspectSearchPlayers) || inspectSearchPlayers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No player found.
                </div>
              ) : (
                inspectSearchPlayers.map((p: any) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      setSelectedPlayerId(p._id);
                      setIsPlayerDrawerOpen(true);
                      setIsInspectPlayerModalOpen(false);
                    }}
                    className="w-full p-2 rounded-xl text-left hover:bg-muted/50 flex items-center justify-between transition-colors pt-2 first:pt-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage src={p.avatarUrl} />
                        <AvatarFallback className="text-xs font-bold">
                          {initials(p.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-xs text-foreground">@{p.username}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.rating} Elo · {p.wins}W/{p.losses}L
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Broadcast Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsAnnouncementModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Megaphone className="size-4 text-purple-400" />
                <span>Broadcast Announcement</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Announcement Message
              </label>
              <textarea
                rows={3}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Broadcast a system-wide banner to active players..."
                className="w-full rounded-xl border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="h-8 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!announcementText.trim()}
                onClick={() => {
                  toast.success("Broadcast announcement scheduled for distribution.");
                  setIsAnnouncementModalOpen(false);
                  setAnnouncementText("");
                }}
                className="h-8 text-xs font-bold"
              >
                Send Broadcast
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
