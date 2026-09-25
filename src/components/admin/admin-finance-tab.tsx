"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  History,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatEtb } from "@/lib/payments/money";

export function AdminFinanceTab() {
  const overview = useQuery(api.admin.finance.financialOverview, {});
  const reconciliation = useQuery(api.admin.finance.financialReconciliation, { limit: 40 });

  const freezeWallet = useMutation(api.admin.finance.freezeWallet);
  const unfreezeWallet = useMutation(api.admin.finance.unfreezeWallet);

  const [freezeUserId, setFreezeUserId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [isProcessingFreeze, setIsProcessingFreeze] = useState(false);

  async function handleFreezeAction(action: "freeze" | "unfreeze") {
    if (!freezeUserId.trim()) {
      toast.error("Please enter a User ID");
      return;
    }
    if (action === "freeze" && !freezeReason.trim()) {
      toast.error("Please specify a reason for freezing the wallet");
      return;
    }

    setIsProcessingFreeze(true);
    try {
      if (action === "freeze") {
        await freezeWallet({
          targetUserId: freezeUserId as any,
          reason: freezeReason,
        });
        toast.success("Wallet successfully frozen.");
      } else {
        await unfreezeWallet({
          targetUserId: freezeUserId as any,
          reason: freezeReason || "Administrative unfreeze",
        });
        toast.success("Wallet successfully un-frozen.");
      }
      setFreezeUserId("");
      setFreezeReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update wallet freeze status");
    } finally {
      setIsProcessingFreeze(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">User Liability</span>
            <Wallet className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            {overview ? `${overview.totalLiabilityEtb.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground">Authoritative available balances</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Locked Escrow</span>
            <Lock className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            {overview ? `${overview.totalLockedEtb.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground">Match stakes & pending payouts</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Platform Revenue</span>
            <Coins className="size-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-400">
            {overview ? `${overview.totalCommissionEtb.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground">Accumulated 10% match commission</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Provider Fees</span>
            <CreditCard className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            {overview ? `${overview.totalProviderFeesEtb.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground">Total Chapa gateway fees</p>
        </div>
      </div>

      {/* Freeze / Security Control Panel */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
          <ShieldAlert className="size-5 text-amber-500" />
          <div>
            <h3 className="text-base font-black text-foreground">Wallet Security & Freeze Controls</h3>
            <p className="text-xs text-muted-foreground">
              Immediately restrict or restore a player's ability to deposit, stake, or withdraw
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">
              Player User ID
            </label>
            <input
              type="text"
              placeholder="e.g. k57... or clerkId"
              value={freezeUserId}
              onChange={(e) => setFreezeUserId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">
              Audit Reason
            </label>
            <input
              type="text"
              placeholder="Reason for freeze / unfreeze"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={() => handleFreezeAction("freeze")}
              disabled={isProcessingFreeze}
              className="flex-1 h-11 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-white gap-1.5"
            >
              <Lock className="size-3.5" />
              Freeze Wallet
            </Button>
            <Button
              onClick={() => handleFreezeAction("unfreeze")}
              disabled={isProcessingFreeze}
              variant="outline"
              className="flex-1 h-11 rounded-xl text-xs font-bold gap-1.5"
            >
              <Unlock className="size-3.5 text-emerald-500" />
              Unfreeze
            </Button>
          </div>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4.5 text-emerald-500" />
            <div>
              <h3 className="font-extrabold text-foreground text-sm sm:text-base">
                Transaction Reconciliation
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Comparing internal transactions against provider references
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Internal Ref</th>
                <th className="p-3.5">Provider Ref</th>
                <th className="p-3.5">Credit / Payout</th>
                <th className="p-3.5">Provider Fee</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {reconciliation?.deposits.map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="p-3.5 text-foreground font-bold">{d.ref}</td>
                  <td className="p-3.5 text-muted-foreground">{d.providerRef || "—"}</td>
                  <td className="p-3.5 text-emerald-500 font-bold">{d.creditEtb.toFixed(2)} ETB</td>
                  <td className="p-3.5 text-muted-foreground">{d.feeEtb.toFixed(2)} ETB</td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                        d.status === "credited"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : d.status === "failed"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-muted-foreground font-sans text-[11px]">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
