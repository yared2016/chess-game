"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DepositFlow } from "./deposit-flow";
import { WithdrawFlow } from "./withdraw-flow";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  History,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";

export function WalletView() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const balance = useQuery(api.wallets?.getBalance as any, isAuthenticated ? {} : "skip");
  const deposits = useQuery(api.deposits?.myDeposits as any, isAuthenticated ? {} : "skip");
  const withdrawals = useQuery(api.withdrawals?.myWithdrawals as any, isAuthenticated ? {} : "skip");
  const ensureWallet = useMutation(api.wallets?.ensureWallet as any);

  const [activeTab, setActiveTab] = useState<"overview" | "deposit" | "withdraw">("overview");
  const [historyFilter, setHistoryFilter] = useState<"all" | "deposits" | "withdrawals">("all");
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

  if (balance === undefined) {
    if (timedOut) {
      return (
        <div className="mx-auto max-w-md p-8 text-center space-y-4 rounded-2xl border border-border bg-card my-12">
          <AlertCircle className="size-10 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Connection Slow</h3>
          <p className="text-muted-foreground text-sm">
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
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">
          {isAuthLoading ? "Authenticating with game server..." : "Loading wallet balance..."}
        </p>
      </div>
    );
  }

  const available = balance?.available ?? 0;
  const locked = balance?.locked ?? 0;
  const total = available + locked;

  // Combine and sort transactions
  const combinedHistory = [
    ...(deposits || []).map((d: any) => ({ ...d, type: "deposit" as const })),
    ...(withdrawals || []).map((w: any) => ({ ...w, type: "withdrawal" as const })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const filteredHistory = combinedHistory.filter((item) => {
    if (historyFilter === "deposits") return item.type === "deposit";
    if (historyFilter === "withdrawals") return item.type === "withdrawal";
    return true;
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Wallet className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              My Wallet
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your ETB balance, deposits, and cashouts.
            </p>
          </div>
        </div>

        {activeTab !== "overview" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("overview")}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Overview
          </Button>
        )}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Hero Balance Card */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-md">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Available Balance
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-green-500">
                    {available.toLocaleString()}
                  </span>
                  <span className="text-lg font-bold text-foreground">ETB</span>
                </div>
              </div>

              {/* Sub-balances */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div className="rounded-xl bg-muted/30 p-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Lock className="size-3 text-amber-500" />
                    In Active Matches
                  </span>
                  <span className="text-base font-bold text-amber-500 mt-0.5 block">
                    {locked.toLocaleString()} ETB
                  </span>
                </div>
                <div className="rounded-xl bg-muted/30 p-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Total Assets
                  </span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    {total.toLocaleString()} ETB
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  size="lg"
                  onClick={() => setActiveTab("deposit")}
                  className="h-12 font-bold text-base gap-2 rounded-xl shadow-sm"
                >
                  <Plus className="size-5" />
                  Deposit ETB
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setActiveTab("withdraw")}
                  className="h-12 font-bold text-base gap-2 rounded-xl border-border hover:bg-muted"
                >
                  <ArrowDownLeft className="size-5 text-primary" />
                  Withdraw
                </Button>
              </div>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm sm:text-base">Transaction History</h3>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg bg-background p-1 border">
                {(["all", "deposits", "withdrawals"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${
                      historyFilter === filter
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-border/60 max-h-[460px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">No transactions recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Deposit ETB via Telebirr or CBE to start competing in staked chess games!
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
                      className="p-4 sm:px-5 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-xl p-2.5 mt-0.5 ${
                            isDeposit
                              ? "bg-green-500/10 text-green-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="size-4" />
                          ) : (
                            <ArrowUpRight className="size-4" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">
                            {isDeposit ? `Deposit (${item.code})` : `Withdrawal (${item.payoutMethod})`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.createdAt || item._creationTime).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {isRejected && item.rejectionReason && (
                            <p className="text-xs text-destructive font-medium mt-1">
                              Reason: {item.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pl-11 sm:pl-0">
                        <span
                          className={`text-base font-extrabold ${
                            isDeposit ? "text-green-500" : "text-foreground"
                          }`}
                        >
                          {isDeposit ? "+" : "-"}
                          {item.amount} ETB
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isApproved
                              ? "bg-green-500/10 text-green-500"
                              : isPending
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-destructive/10 text-destructive"
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
        </>
      )}

      {activeTab === "deposit" && <DepositFlow />}
      {activeTab === "withdraw" && <WithdrawFlow />}
    </div>
  );
}
