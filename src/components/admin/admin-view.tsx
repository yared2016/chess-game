"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { AdminFinanceTab } from "./admin-finance-tab";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Swords,
  TrendingUp,
  Users,
  Wallet,
  Coins,
  XCircle,
  Eye,
  X,
  FileImage,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";

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

type AdminTab = "financials" | "deposits" | "withdrawals" | "players" | "matches";

export function AdminView() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(api.admin?.isAdmin as any, isAuthenticated ? {} : "skip");

  const [activeTab, setActiveTab] = useState<AdminTab>("financials");
  const [isSyncing, setIsSyncing] = useState(false);
  const [depositSearch, setDepositSearch] = useState("");
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    type: "deposit" | "withdrawal";
    id: string;
    username: string;
    amount: number;
    reference: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Queries
  const platformStats = useQuery(api.admin?.platformStats as any, isAdmin ? {} : "skip");
  const pendingDeposits = useQuery(api.deposits?.pendingDeposits as any, isAdmin ? {} : "skip");
  const pendingWithdrawals = useQuery(api.withdrawals?.pendingWithdrawals as any, isAdmin ? {} : "skip");
  const players = useQuery(api.admin?.listPlayers as any, isAdmin ? { search: playerSearch || undefined } : "skip");
  const recentGames = useQuery(api.admin?.recentGames as any, isAdmin ? { limit: 30 } : "skip");

  // Mutations
  const approveDeposit = useMutation(api.deposits?.approve as any);
  const rejectDeposit = useMutation(api.deposits?.reject as any);
  const completeWithdrawal = useMutation(api.withdrawals?.complete as any);
  const rejectWithdrawal = useMutation(api.withdrawals?.reject as any);
  const markCommissionTransferred = useMutation(api.admin?.markCommissionTransferred as any);
  const syncCommissions = useMutation(api.admin?.syncCommissionsToWallet as any);

  if (isAdmin === false) {
    router.replace("/");
    return null;
  }

  if (isAdmin === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Authenticating administrator permissions...</p>
      </div>
    );
  }

  const handleApproveDeposit = async (id: string) => {
    try {
      await approveDeposit({ depositId: id });
      toast.success("Deposit approved and player wallet balance credited!");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve deposit");
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
        toast.success("Withdrawal rejected and funds refunded to player wallet");
      }
      setRejectModal(null);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject transaction");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCompleteWithdrawal = async (id: string) => {
    try {
      await completeWithdrawal({ withdrawalId: id });
      toast.success("Withdrawal marked as completed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete withdrawal");
    }
  };

  const handleSyncCommissions = async () => {
    try {
      setIsSyncing(true);
      const res = await syncCommissions();
      toast.success(`Admin wallet synchronized! Current balance: ${res?.newBalance ?? 0} ETB`);
    } catch (error: any) {
      toast.error(error.message || "Failed to sync commissions to wallet");
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredDeposits = (pendingDeposits || []).filter((d: any) => {
    if (!depositSearch) return true;
    const q = depositSearch.toLowerCase();
    return (
      d.username?.toLowerCase().includes(q) ||
      d.code?.toLowerCase().includes(q) ||
      d.senderInfo?.toLowerCase().includes(q)
    );
  });

  const filteredWithdrawals = (pendingWithdrawals || []).filter((w: any) => {
    if (!withdrawalSearch) return true;
    const q = withdrawalSearch.toLowerCase();
    return (
      w.username?.toLowerCase().includes(q) ||
      w.payoutAccount?.toLowerCase().includes(q) ||
      w.payoutMethod?.toLowerCase().includes(q)
    );
  });

  const pendingDepositsCount = pendingDeposits?.length ?? 0;
  const pendingWithdrawalsCount = pendingWithdrawals?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Command Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time financial management, player directory, escrow settlement, and payment approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/wallet"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5 text-xs font-bold" })}
          >
            <Wallet className="size-3.5 text-green-500" />
            My Admin Wallet ({platformStats?.adminWalletBalance ?? 0} ETB)
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncCommissions}
            disabled={isSyncing}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Rake
          </Button>
        </div>
      </div>

      {/* Modern High-Impact Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Admin Cashout Balance */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin Wallet (Available)
            </span>
            <Wallet className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-tight text-green-500">
              {(platformStats?.adminWalletBalance ?? 0).toLocaleString()}
            </span>
            <span className="text-sm font-bold text-foreground">ETB</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Directly withdrawable via Telebirr or CBE Bank.
          </p>
        </div>

        {/* Metric 2: Total Match Commission (10% Rake) */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total 10% Match Rake
            </span>
            <TrendingUp className="size-4 text-green-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {(platformStats?.totalCommission ?? 0).toLocaleString()}
            </span>
            <span className="text-sm font-bold text-foreground">ETB</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Accumulated earnings across all completed matches.
          </p>
        </div>

        {/* Metric 3: Deposits & Withdrawals Liquidity */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Inflows / Outflows
            </span>
            <Banknote className="size-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-green-500">
              +{(platformStats?.totalDeposits ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">/ -{(platformStats?.totalWithdrawals ?? 0).toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ETB volume processed across players.
          </p>
        </div>

        {/* Metric 4: Registered Players */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Registered Players
            </span>
            <Users className="size-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-foreground">
              {platformStats?.totalUsers ?? 0}
            </span>
            <span className="text-xs font-bold text-muted-foreground">PLAYERS</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Active chess accounts in system.</p>
        </div>
      </div>

      {/* Modern 5-Tab Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("financials")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "financials"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <TrendingUp className="size-4" />
          Financials & Revenue
        </button>

        <button
          onClick={() => setActiveTab("deposits")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "deposits"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <ArrowDownLeft className="size-4" />
          Deposits Queue
          {pendingDepositsCount > 0 && (
            <span className="rounded-full bg-green-500 text-white text-[11px] px-2 py-0.2 font-extrabold">
              {pendingDepositsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "withdrawals"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <ArrowUpRight className="size-4" />
          Withdrawals Queue
          {pendingWithdrawalsCount > 0 && (
            <span className="rounded-full bg-amber-500 text-black text-[11px] px-2 py-0.2 font-extrabold">
              {pendingWithdrawalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("players")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "players"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          Players Directory ({players?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("matches")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "matches"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Swords className="size-4" />
          Matches & Escrow
        </button>
      </div>

      {/* Tab 1: Financials & Revenue */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          <AdminFinanceTab />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-base">Admin Cashout Portal</h3>
                <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-bold text-green-500">
                  Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                All platform commissions on staked matches are automatically credited to your admin wallet.
                You can withdraw these funds straight to your <strong>Telebirr</strong> or <strong>CBE Bank</strong> account anytime.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Link
                  href="/wallet"
                  className={cn(buttonVariants({ size: "default" }), "h-10 text-xs font-bold bg-green-600 hover:bg-green-700 text-white")}
                >
                  Withdraw Admin Earnings to Bank
                </Link>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleSyncCommissions}
                  disabled={isSyncing}
                  className="h-10 text-xs font-bold"
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync Historical Commissions
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-base">Commission Transfer Settlement</h3>
                <span className="font-mono text-xs font-bold text-amber-500">
                  Pending: {platformStats?.pendingTransfer ?? 0} ETB
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Track and log internal accounting transfers from Account 1 to Account 2. Marking as transferred
                updates historical bookkeeping records.
              </p>
              <Button
                variant="outline"
                className="w-full h-10 text-xs font-bold"
                disabled={!platformStats?.pendingTransfer || platformStats.pendingTransfer <= 0}
                onClick={async () => {
                  try {
                    await markCommissionTransferred();
                    toast.success("Commissions marked as transferred in ledger");
                  } catch (err: any) {
                    toast.error(err.message || "Transfer marking failed");
                  }
                }}
              >
                Mark Pending Commission as Transferred
              </Button>
            </div>
          </div>

          {/* Recent Match Commission Ledger */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <Coins className="size-4 text-primary" />
                  10% Match Commission Ledger
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audit trail of all 10% platform cuts automatically extracted upon match conclusions.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-primary">10% Platform Rake</span>
            </div>

            <div className="divide-y max-h-96 overflow-y-auto">
              {!platformStats?.recentCommissions || platformStats.recentCommissions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No match commissions recorded yet. Play a staked match to generate commissions!
                </div>
              ) : (
                platformStats.recentCommissions.map((c: any) => (
                  <div key={c._id} className="p-4 flex items-center justify-between hover:bg-muted/30 text-xs transition-colors">
                    <div className="space-y-1">
                      <p className="font-mono font-bold text-foreground">
                        Game ID: <span className="text-primary">{c.gameId}</span>
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Recorded: {new Date(c.createdAt || c._creationTime).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-green-500 text-sm sm:text-base">
                        +{c.amount} ETB
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          c.transferred
                            ? "bg-green-500/10 text-green-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {c.transferred ? "Settled" : "Logged"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deposits Queue */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Pending Deposits ({pendingDepositsCount})</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify reference code and sender phone or receipt screenshot before approving.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={depositSearch}
                onChange={(e) => setDepositSearch(e.target.value)}
                placeholder="Search user, code, or phone..."
                className="flex h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {filteredDeposits.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-12 text-center space-y-2 bg-muted/10">
              <CheckCircle2 className="size-9 text-green-500/70 mx-auto" />
              <p className="font-bold text-foreground text-sm">All deposits reviewed</p>
              <p className="text-xs text-muted-foreground">
                {depositSearch ? "No deposit matches your search criteria." : "No pending deposit requests in queue."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {filteredDeposits.map((d: any) => (
                <div
                  key={d._id}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base text-foreground">{d.username}</span>
                      <span className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-mono font-bold text-primary">
                        Code: {d.code}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-green-500">{d.amount} ETB</span>
                    </div>

                    {d.senderInfo && (
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-3 py-1.5 text-xs font-medium">
                        <Phone className="size-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Sender Details:</span>
                        <strong className="text-foreground font-mono">{d.senderInfo}</strong>
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      Requested: {new Date(d.createdAt || d._creationTime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {d.screenshotUrl ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedReceipt(d.screenshotUrl)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        >
                          <Eye className="size-3.5 text-primary" />
                          Preview
                        </button>
                        <a
                          href={d.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                          Open
                        </a>
                      </div>
                    ) : (
                      <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500 text-center">
                        No Screenshot (Code / Sender Verified)
                      </span>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-initial h-9 font-semibold text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApproveDeposit(d._id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 sm:flex-initial h-9 font-semibold text-xs"
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Withdrawals Queue */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Pending Withdrawals ({pendingWithdrawalsCount})</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Execute bank transfer on your mobile app and click &quot;Mark as Paid&quot;.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={withdrawalSearch}
                onChange={(e) => setWithdrawalSearch(e.target.value)}
                placeholder="Search user or account..."
                className="flex h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {filteredWithdrawals.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-12 text-center space-y-2 bg-muted/10">
              <CheckCircle2 className="size-9 text-green-500/70 mx-auto" />
              <p className="font-bold text-foreground text-sm">No pending cashouts</p>
              <p className="text-xs text-muted-foreground">All player cashout requests have been processed.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {filteredWithdrawals.map((w: any) => (
                <div
                  key={w._id}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base text-foreground">{w.username}</span>
                      <span className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                        {w.payoutMethod === "cbe" ? "CBE Bank" : "Telebirr"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-foreground">{w.amount} ETB</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">Transfer to:</span>
                      <strong className="text-foreground font-mono text-sm">{w.payoutAccount}</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(w.payoutAccount);
                          toast.success("Account copied to clipboard!");
                        }}
                        className="ml-auto text-[11px] font-bold text-primary hover:underline"
                      >
                        Copy
                      </button>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Requested: {new Date(w.createdAt || w._creationTime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2 self-end md:self-center">
                    <Button
                      size="sm"
                      className="h-9 font-semibold text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleCompleteWithdrawal(w._id)}
                    >
                      Mark as Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9 font-semibold text-xs"
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
                      Reject & Refund
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Players Directory */}
      {activeTab === "players" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Registered Players ({players?.length ?? 0})</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect player accounts, ratings, win rates, and live wallet balances.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search username..."
                className="flex h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 sm:px-4">Player</th>
                    <th className="p-3.5 sm:px-4">Rating</th>
                    <th className="p-3.5 sm:px-4">Record (W/L/D)</th>
                    <th className="p-3.5 sm:px-4">Wallet Balance</th>
                    <th className="p-3.5 sm:px-4">Pro Status</th>
                    <th className="p-3.5 sm:px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {!players || players.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                        No players found.
                      </td>
                    </tr>
                  ) : (
                    players.map((p: any) => {
                      const isPro = Boolean(p.proUntil && p.proUntil > Date.now());
                      return (
                        <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 sm:px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8">
                                <AvatarImage src={p.avatarUrl} alt={p.username} />
                                <AvatarFallback className="text-xs font-bold">{initials(p.username)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-foreground text-sm">{p.username}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  Joined {new Date(p.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 sm:px-4 font-mono font-bold text-foreground">
                            {formatRating(p.rating)}
                          </td>

                          <td className="p-3.5 sm:px-4 font-mono">
                            <span className="text-green-500 font-bold">{p.wins}W</span> ·{" "}
                            <span className="text-red-500 font-bold">{p.losses}L</span> ·{" "}
                            <span className="text-muted-foreground">{p.draws}D</span>
                          </td>

                          <td className="p-3.5 sm:px-4 font-mono">
                            <span className="font-black text-green-500">{p.availableBalance} ETB</span>
                            {p.lockedBalance > 0 && (
                              <span className="text-[10px] text-amber-500 block">
                                ({p.lockedBalance} ETB in game)
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 sm:px-4">
                            {isPro ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                                Pro Active
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Free Tier</span>
                            )}
                          </td>

                          <td className="p-3.5 sm:px-4 text-right">
                            <Link
                              href={`/profile/${encodeURIComponent(p.username)}`}
                              className={buttonVariants({ variant: "outline", size: "xs" })}
                            >
                              Profile
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Matches & Escrow Inspector */}
      {activeTab === "matches" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Recent Matches & Escrow Inspector</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live inspection of recent games, stake pools, outcomes, and settled commissions.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 sm:px-4">Game</th>
                    <th className="p-3.5 sm:px-4">Mode</th>
                    <th className="p-3.5 sm:px-4">Stake Pool</th>
                    <th className="p-3.5 sm:px-4">Winner</th>
                    <th className="p-3.5 sm:px-4">Commission Rake</th>
                    <th className="p-3.5 sm:px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {!recentGames || recentGames.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                        No games played yet.
                      </td>
                    </tr>
                  ) : (
                    recentGames.map((g: any) => (
                      <tr key={g._id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 sm:px-4">
                          <p className="font-bold text-foreground">
                            {g.whiteUsername} <span className="font-normal text-muted-foreground">vs</span> {g.blackUsername}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {new Date(g.createdAt).toLocaleString()} · {g.moveCount} moves
                          </p>
                        </td>

                        <td className="p-3.5 sm:px-4 font-semibold capitalize text-foreground">
                          {g.mode}
                        </td>

                        <td className="p-3.5 sm:px-4 font-mono font-bold">
                          {g.stake > 0 ? (
                            <span className="text-green-500">{g.stake * 2} ETB</span>
                          ) : (
                            <span className="text-muted-foreground">Free</span>
                          )}
                        </td>

                        <td className="p-3.5 sm:px-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              g.status === "active"
                                ? "bg-primary/10 text-primary"
                                : g.winner
                                ? "bg-green-500/10 text-green-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {g.status === "active"
                              ? "Live"
                              : g.winner === "w"
                              ? `White (${g.whiteUsername})`
                              : g.winner === "b"
                              ? `Black (${g.blackUsername})`
                              : "Draw"}
                          </span>
                        </td>

                        <td className="p-3.5 sm:px-4 font-mono font-bold text-foreground">
                          {g.commission > 0 ? (
                            <span className="text-primary font-black">+{g.commission} ETB</span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="p-3.5 sm:px-4 text-right">
                          <Link
                            href={`/game/${g._id}`}
                            className={buttonVariants({ variant: "outline", size: "xs" })}
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-lg w-full overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileImage className="size-4 text-primary" />
                Payment Receipt Preview
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="pt-3 max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={selectedReceipt}
                alt="Payment Receipt"
                className="rounded-xl max-h-full max-w-full object-contain"
              />
            </div>
            <div className="pt-3 text-right">
              <a
                href={selectedReceipt}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "text-xs font-semibold gap-1.5")}
              >
                <ExternalLink className="size-3.5" />
                Open Full Resolution
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Sleek In-App Rejection Modal */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isRejecting && setRejectModal(null)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Reject {rejectModal.type === "deposit" ? "Deposit Request" : "Cashout Request"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Provide a transparent reason for the player.
                  </p>
                </div>
              </div>
              <button
                disabled={isRejecting}
                onClick={() => setRejectModal(null)}
                className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Target details pill */}
            <div className="rounded-2xl border border-border bg-muted/40 p-3.5 flex items-center justify-between text-xs">
              <div>
                <p className="font-extrabold text-foreground text-sm">{rejectModal.username}</p>
                <p className="font-mono text-muted-foreground text-[11px] mt-0.5">
                  Ref: <span className="text-foreground font-semibold">{rejectModal.reference}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-black text-destructive">
                  {rejectModal.amount} ETB
                </span>
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                  {rejectModal.type}
                </span>
              </div>
            </div>

            {/* Quick-Select Reason Chips */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Quick Select Reason
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(rejectModal.type === "deposit" ? DEPOSIT_REASONS : WITHDRAWAL_REASONS).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-medium border text-left transition-all ${
                      rejectionReason === reason
                        ? "border-destructive bg-destructive/15 text-destructive font-semibold"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom reason textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Detailed Explanation
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Write specific notes or instructions for the user..."
                className="w-full rounded-xl border border-input bg-background p-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                This notice will appear in the player&apos;s transaction history.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
              <Button
                variant="outline"
                size="sm"
                disabled={isRejecting}
                onClick={() => setRejectModal(null)}
                className="h-9 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isRejecting || !rejectionReason.trim()}
                onClick={handleConfirmRejection}
                className="h-9 px-4 text-xs font-bold gap-1.5"
              >
                {isRejecting ? "Processing..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
