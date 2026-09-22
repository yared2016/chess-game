"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AdminView() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(api.admin?.isAdmin as any, isAuthenticated ? {} : "skip");

  const [activeTab, setActiveTab] = useState<"deposits" | "withdrawals" | "revenue">("deposits");

  const pendingDeposits = useQuery(api.deposits?.pendingDeposits as any, isAdmin ? {} : "skip");
  const approveDeposit = useMutation(api.deposits?.approve as any);
  const rejectDeposit = useMutation(api.deposits?.reject as any);
  
  const pendingWithdrawals = useQuery(api.withdrawals?.pendingWithdrawals as any, isAdmin ? {} : "skip");
  const completeWithdrawal = useMutation(api.withdrawals?.complete as any);
  const rejectWithdrawal = useMutation(api.withdrawals?.reject as any);
  
  const platformStats = useQuery(api.admin?.platformStats as any, isAdmin ? {} : "skip");
  const markCommissionTransferred = useMutation(api.admin?.markCommissionTransferred as any);

  if (isAdmin === false) {
    router.replace("/");
    return null;
  }

  if (isAdmin === undefined) {
    return <div className="p-8 text-center">Loading admin panel...</div>;
  }

  const handleApproveDeposit = async (id: string) => {
    try {
      await approveDeposit({ depositId: id });
      toast.success("Deposit approved");
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
      toast.success("Withdrawal marked as complete");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete withdrawal");
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this withdrawal (optional):") ?? "Rejected by admin";
    try {
      await rejectWithdrawal({ withdrawalId: id, reason });
      toast.success("Withdrawal rejected");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject withdrawal");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="flex gap-2 mb-8">
        <Button 
          variant={activeTab === "deposits" ? "default" : "outline"} 
          onClick={() => setActiveTab("deposits")}
        >
          Deposits
        </Button>
        <Button 
          variant={activeTab === "withdrawals" ? "default" : "outline"} 
          onClick={() => setActiveTab("withdrawals")}
        >
          Withdrawals
        </Button>
        <Button 
          variant={activeTab === "revenue" ? "default" : "outline"} 
          onClick={() => setActiveTab("revenue")}
        >
          Revenue
        </Button>
      </div>

      {activeTab === "deposits" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Deposits</h2>
          {!pendingDeposits || pendingDeposits.length === 0 ? (
            <p className="text-muted-foreground">No pending deposits.</p>
          ) : (
            <div className="grid gap-4">
              {pendingDeposits.map((d: any) => (
                <div key={d._id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">User: {d.username}</p>
                    <p className="text-lg font-bold text-green-500">{d.amount} ETB</p>
                    <p className="text-sm font-mono text-muted-foreground">Code: <span className="text-foreground font-semibold">{d.code}</span></p>
                    <p className="text-xs text-muted-foreground">{new Date(d._creationTime).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:items-end">
                    {d.screenshotUrl ? (
                      <a
                        href={d.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        📷 View Screenshot
                      </a>
                    ) : (
                      <span className="text-xs text-amber-500/80 italic">No screenshot attached</span>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApproveDeposit(d._id)}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRejectDeposit(d._id)}>Reject</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Withdrawals</h2>
          {!pendingWithdrawals || pendingWithdrawals.length === 0 ? (
            <p className="text-muted-foreground">No pending withdrawals.</p>
          ) : (
            <div className="grid gap-4">
              {pendingWithdrawals.map((w: any) => (
                <div key={w._id} className="rounded-xl border bg-card p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">User: {w.username}</p>
                    <p>Amount: {w.amount} ETB</p>
                    <p>Method: {w.payoutMethod}</p>
                    <p className="text-sm font-mono text-muted-foreground">Account: {w.payoutAccount}</p>
                    <p className="text-sm text-muted-foreground">{new Date(w._creationTime).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCompleteWithdrawal(w._id)}>Mark as Paid</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRejectWithdrawal(w._id)}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="space-y-8">
          <h2 className="text-xl font-semibold">Platform Revenue</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total Commission Earned</h3>
              <p className="mt-2 text-3xl font-bold text-green-500">{platformStats?.totalCommission ?? 0} ETB</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Pending Transfer</h3>
              <p className="mt-2 text-3xl font-bold text-amber-500">{platformStats?.pendingTransfer ?? 0} ETB</p>
              <Button 
                className="mt-4 w-full"
                disabled={!platformStats?.pendingTransfer || platformStats.pendingTransfer <= 0}
                onClick={async () => {
                  try {
                    await markCommissionTransferred();
                    toast.success("Commission marked as transferred");
                  } catch (error: any) {
                    toast.error(error.message || "Failed to mark as transferred");
                  }
                }}
              >
                Mark as Transferred
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
