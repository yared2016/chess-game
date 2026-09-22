"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export function AdminView() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(api.admin?.isAdmin as any, isAuthenticated ? {} : "skip");

  const [activeTab, setActiveTab] = useState<"deposits" | "withdrawals" | "revenue">("deposits");
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingDeposits = useQuery(api.deposits?.pendingDeposits as any, isAdmin ? {} : "skip");
  const approveDeposit = useMutation(api.deposits?.approve as any);
  const rejectDeposit = useMutation(api.deposits?.reject as any);

  const pendingWithdrawals = useQuery(api.withdrawals?.pendingWithdrawals as any, isAdmin ? {} : "skip");
  const completeWithdrawal = useMutation(api.withdrawals?.complete as any);
  const rejectWithdrawal = useMutation(api.withdrawals?.reject as any);

  const platformStats = useQuery(api.admin?.platformStats as any, isAdmin ? {} : "skip");
  const markCommissionTransferred = useMutation(api.admin?.markCommissionTransferred as any);
  const syncCommissions = useMutation(api.admin?.syncCommissionsToWallet as any);

  if (isAdmin === false) {
    router.replace("/");
    return null;
  }

  if (isAdmin === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Verifying admin credentials...</p>
      </div>
    );
  }

  const handleApproveDeposit = async (id: string) => {
    try {
      await approveDeposit({ depositId: id });
      toast.success("Deposit approved and user wallet credited!");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve deposit");
    }
  };

  const handleRejectDeposit = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this deposit (optional):") ?? "Rejected by admin";
    try {
      await rejectDeposit({ depositId: id, reason });
      toast.success("Deposit rejected");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject deposit");
    }
  };

  const handleCompleteWithdrawal = async (id: string) => {
    try {
      await completeWithdrawal({ withdrawalId: id });
      toast.success("Withdrawal marked as completed and paid!");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete withdrawal");
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this withdrawal (optional):") ?? "Rejected by admin";
    try {
      await rejectWithdrawal({ withdrawalId: id, reason });
      toast.success("Withdrawal rejected and amount refunded to user");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject withdrawal");
    }
  };

  const handleSyncCommissions = async () => {
    try {
      setIsSyncing(true);
      const res = await syncCommissions();
      toast.success(`Admin wallet synced! Current Balance: ${res?.newBalance ?? 0} ETB`);
    } catch (error: any) {
      toast.error(error.message || "Failed to sync commissions to wallet");
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingDepositsCount = pendingDeposits?.length ?? 0;
  const pendingWithdrawalsCount = pendingWithdrawals?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Admin Management Portal
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Review ETB deposits, execute payouts, track match commissions, and manage escrow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/wallet"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5 text-xs font-semibold" })}
          >
            <Wallet className="size-3.5 text-green-500" />
            My Admin Wallet
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <Button
          variant={activeTab === "deposits" ? "default" : "outline"}
          onClick={() => setActiveTab("deposits")}
          className="gap-2 text-xs sm:text-sm"
        >
          <ArrowDownLeft className="size-4" />
          Pending Deposits
          {pendingDepositsCount > 0 && (
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold">
              {pendingDepositsCount}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "withdrawals" ? "default" : "outline"}
          onClick={() => setActiveTab("withdrawals")}
          className="gap-2 text-xs sm:text-sm"
        >
          <ArrowUpRight className="size-4" />
          Pending Withdrawals
          {pendingWithdrawalsCount > 0 && (
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-bold">
              {pendingWithdrawalsCount}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "revenue" ? "default" : "outline"}
          onClick={() => setActiveTab("revenue")}
          className="gap-2 text-xs sm:text-sm"
        >
          <TrendingUp className="size-4 text-green-500" />
          Revenue & Platform Stats
        </Button>
      </div>

      {/* Tab 1: Deposits */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Pending Deposits ({pendingDepositsCount})
            </h2>
            <span className="text-xs text-muted-foreground">
              Review code and sender details before approving
            </span>
          </div>

          {!pendingDeposits || pendingDeposits.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center space-y-2 bg-muted/10">
              <CheckCircle2 className="size-8 text-green-500/70 mx-auto" />
              <p className="font-semibold text-foreground text-sm">All deposits reviewed</p>
              <p className="text-xs text-muted-foreground">
                There are no pending deposit requests at this time.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {pendingDeposits.map((d: any) => (
                <div
                  key={d._id}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-foreground">{d.username}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-bold text-primary">
                        Code: {d.code}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-green-500">{d.amount} ETB</span>
                    </div>

                    {d.senderInfo && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-1.5 text-xs">
                        <Phone className="size-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Sender Info:</span>
                        <strong className="text-foreground font-mono">{d.senderInfo}</strong>
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      Requested: {new Date(d.createdAt || d._creationTime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {d.screenshotUrl ? (
                      <a
                        href={d.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors text-center"
                      >
                        <ExternalLink className="size-3.5" />
                        View Screenshot
                      </a>
                    ) : (
                      <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500 text-center">
                        No Screenshot (Verify Code / Sender)
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
                        onClick={() => handleRejectDeposit(d._id)}
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

      {/* Tab 2: Withdrawals */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Pending Withdrawals ({pendingWithdrawalsCount})
            </h2>
            <span className="text-xs text-muted-foreground">
              Transfer funds to player accounts and mark as paid
            </span>
          </div>

          {!pendingWithdrawals || pendingWithdrawals.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center space-y-2 bg-muted/10">
              <CheckCircle2 className="size-8 text-green-500/70 mx-auto" />
              <p className="font-semibold text-foreground text-sm">No pending cashouts</p>
              <p className="text-xs text-muted-foreground">
                All player withdrawal requests have been processed.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {pendingWithdrawals.map((w: any) => (
                <div
                  key={w._id}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-foreground">{w.username}</span>
                      <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary capitalize">
                        {w.payoutMethod === "cbe" ? "CBE Bank" : "Telebirr"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground">{w.amount} ETB</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">Account / Phone:</span>
                      <strong className="text-foreground font-mono text-sm">{w.payoutAccount}</strong>
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
                      onClick={() => handleRejectWithdrawal(w._id)}
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

      {/* Tab 3: Revenue & Stats */}
      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="size-5 text-green-500" />
                Platform Financials & Commissions
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                10% platform commission on every staked chess match pool.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCommissions}
              disabled={isSyncing}
              className="gap-2 text-xs font-semibold self-start sm:self-auto"
            >
              <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Sync Commissions to Wallet
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Admin Wallet Balance Card */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin Wallet Balance
                </span>
                <Wallet className="size-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-green-500">
                  {platformStats?.adminWalletBalance ?? 0}
                </span>
                <span className="text-sm font-bold text-foreground">ETB</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Commissions ready for withdrawal via Telebirr or CBE.
              </p>
              <div className="pt-1">
                <Link
                  href="/wallet"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs font-semibold h-8" })}
                >
                  Go to Cashout Wallet
                </Link>
              </div>
            </div>

            {/* Total Commission Earned Card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Match Commissions
                </span>
                <TrendingUp className="size-4 text-green-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground">
                  {platformStats?.totalCommission ?? platformStats?.totalCommissionEarned ?? 0}
                </span>
                <span className="text-sm font-bold text-foreground">ETB</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lifetime 10% rake collected from all staked matches.
              </p>
            </div>

            {/* Pending Transfers Card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Transfer
                </span>
                <Clock className="size-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-500">
                  {platformStats?.pendingTransfer ?? platformStats?.pendingCommission ?? 0}
                </span>
                <span className="text-sm font-bold text-foreground">ETB</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs font-semibold h-8"
                disabled={!platformStats?.pendingTransfer || platformStats.pendingTransfer <= 0}
                onClick={async () => {
                  try {
                    await markCommissionTransferred();
                    toast.success("Commissions marked as transferred");
                  } catch (error: any) {
                    toast.error(error.message || "Failed to mark as transferred");
                  }
                }}
              >
                Mark as Transferred
              </Button>
            </div>

            {/* Platform Volume Stats */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Users
              </span>
              <div className="flex items-baseline gap-2">
                <Users className="size-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  {platformStats?.totalUsers ?? 0}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Approved Deposits
              </span>
              <div className="flex items-baseline gap-2">
                <ArrowDownLeft className="size-5 text-green-500" />
                <span className="text-2xl font-bold text-foreground">
                  {platformStats?.totalDeposits ?? 0} ETB
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Processed Withdrawals
              </span>
              <div className="flex items-baseline gap-2">
                <ArrowUpRight className="size-5 text-amber-500" />
                <span className="text-2xl font-bold text-foreground">
                  {platformStats?.totalWithdrawals ?? 0} ETB
                </span>
              </div>
            </div>
          </div>

          {/* Recent Match Commissions List */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Recent Match Commission Cuts</h3>
              </div>
              <span className="text-xs text-muted-foreground">10% per completed staked match</span>
            </div>

            <div className="divide-y max-h-72 overflow-y-auto">
              {!platformStats?.recentCommissions || platformStats.recentCommissions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No match commissions recorded yet. Play a staked match to generate commissions!
                </div>
              ) : (
                platformStats.recentCommissions.map((c: any) => (
                  <div key={c._id} className="p-3.5 flex items-center justify-between hover:bg-muted/30 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-mono text-foreground font-semibold">
                        Game ID: {c.gameId}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {new Date(c.createdAt || c._creationTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-green-500 text-sm">
                        +{c.amount} ETB
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
    </div>
  );
}
