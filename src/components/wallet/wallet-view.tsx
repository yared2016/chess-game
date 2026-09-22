"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DepositFlow } from "./deposit-flow";
import { WithdrawFlow } from "./withdraw-flow";
import { Button } from "@/components/ui/button";

export function WalletView() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const balance = useQuery(api.wallets?.getBalance as any, isAuthenticated ? {} : "skip");
  const deposits = useQuery(api.deposits?.myDeposits as any, isAuthenticated ? {} : "skip");
  const withdrawals = useQuery(api.withdrawals?.myWithdrawals as any, isAuthenticated ? {} : "skip");
  const ensureWallet = useMutation(api.wallets?.ensureWallet as any);

  const [activeTab, setActiveTab] = useState<"overview" | "deposit" | "withdraw">("overview");
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
        <div className="mx-auto max-w-md p-12 text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Connecting to your wallet took longer than usual. Please refresh to reconnect.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      );
    }

    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse">
        {isAuthLoading ? "Authenticating with game server..." : "Loading wallet..."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">My Wallet</h1>

      {activeTab === "overview" && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Available</h3>
              <p className="mt-2 text-3xl font-bold text-green-500">{balance?.available ?? 0} ETB</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Locked</h3>
              <p className="mt-2 text-3xl font-bold text-amber-500">{balance?.locked ?? 0} ETB</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total</h3>
              <p className="mt-2 text-3xl font-bold">{(balance?.available ?? 0) + (balance?.locked ?? 0)} ETB</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={() => setActiveTab("deposit")} className="flex-1">Deposit</Button>
            <Button onClick={() => setActiveTab("withdraw")} variant="outline" className="flex-1">Withdraw</Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold">Recent Transactions</h3>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {(!deposits || deposits.length === 0) && (!withdrawals || withdrawals.length === 0) ? (
                <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
              ) : (
                <>
                  {deposits?.map((d: any) => (
                    <div key={d._id} className="flex justify-between items-center p-4">
                      <div>
                        <p className="font-medium">Deposit ({d.code})</p>
                        <p className="text-sm text-muted-foreground">{new Date(d._creationTime).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-500">+{d.amount} ETB</p>
                        <p className="text-xs uppercase">{d.status}</p>
                      </div>
                    </div>
                  ))}
                  {withdrawals?.map((w: any) => (
                    <div key={w._id} className="flex justify-between items-center p-4">
                      <div>
                        <p className="font-medium">Withdrawal ({w.payoutMethod})</p>
                        <p className="text-sm text-muted-foreground">{new Date(w._creationTime).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-500">-{w.amount} ETB</p>
                        <p className="text-xs uppercase">{w.status}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "deposit" && (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mb-4">
            ← Back to Overview
          </Button>
          <DepositFlow />
        </div>
      )}

      {activeTab === "withdraw" && (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mb-4">
            ← Back to Overview
          </Button>
          <WithdrawFlow />
        </div>
      )}
    </div>
  );
}
