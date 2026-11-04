"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ShieldCheck,
  AlertTriangle,
  Scale,
  Landmark,
  Coins,
  FileText,
  Lock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function OwnerSolvencyCard() {
  const solvency = useQuery((api as any)["financial/solvency"].getSolvencyMetrics, {});
  const trialBalance = useQuery((api as any)["financial/ledger"].getTrialBalance, {});

  const requestPayout = useMutation((api as any)["financial/ownerPayouts"].requestOwnerPayoutCanonical);
  const executePayout = useMutation((api as any)["financial/ownerPayouts"].executeOwnerPayoutCanonical);
  const cancelPayout = useMutation((api as any)["financial/ownerPayouts"].cancelOwnerPayoutCanonical);

  // Owner Payout Form state
  const [payoutAmountEtb, setPayoutAmountEtb] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [paymentChannel, setPaymentChannel] = useState<"cbe_a2a" | "telebirr">("cbe_a2a");
  const [bankVoucherRef, setBankVoucherRef] = useState("");
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLedgerInspector, setShowLedgerInspector] = useState(false);

  const amountEtbNum = parseFloat(payoutAmountEtb) || 0;
  const amountSantims = BigInt(Math.round(amountEtbNum * 100));

  const isDistributableExceeded =
    solvency && amountSantims > BigInt(Math.round(solvency.distributableCapETB * 100));

  const projectedPostEligibleCash = solvency
    ? solvency.eligibleCashETB - amountEtbNum
    : 0;
  const isPostSolvencyViolated =
    solvency &&
    solvency.totalObligationsETB > 0 &&
    projectedPostEligibleCash < solvency.required105CoverageETB;

  const handleRequestPayout = async () => {
    if (amountEtbNum <= 0) {
      toast.error("Enter a valid payout amount");
      return;
    }
    if (!destinationAccount.trim()) {
      toast.error("Enter destination bank or wallet account number");
      return;
    }
    if (isDistributableExceeded) {
      toast.error("Requested payout exceeds current Distributable Cash Cap");
      return;
    }
    if (isPostSolvencyViolated) {
      toast.error("Post-payout solvency would violate 105% coverage multiplier");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPayout({
        requestedAmountSantims: amountSantims,
        destinationAccount: destinationAccount.trim(),
      });
      setActivePayoutId(res.payoutId);
      toast.success(`Reserved payout of ${amountEtbNum.toFixed(2)} ETB (ID: ${res.payoutId})`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reserve owner payout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecutePayout = async () => {
    if (!activePayoutId) {
      toast.error("No active reserved payout to settle");
      return;
    }
    if (!bankVoucherRef.trim()) {
      toast.error("Mandatory CBS Statement / Voucher Reference is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await executePayout({
        payoutId: activePayoutId,
        bankVoucherReference: bankVoucherRef.trim(),
        channel: paymentChannel,
      });
      toast.success("Owner payout successfully executed and cleared against ledger");
      setActivePayoutId(null);
      setPayoutAmountEtb("");
      setDestinationAccount("");
      setBankVoucherRef("");
    } catch (err: any) {
      toast.error(err.message || "Failed to execute payout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayout = async () => {
    if (!activePayoutId) return;
    setIsSubmitting(true);
    try {
      await cancelPayout({
        payoutId: activePayoutId,
        reason: "Owner cancelled payout reservation",
      });
      toast.info("Payout reservation cancelled and funds released");
      setActivePayoutId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel payout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge =
    solvency?.status === "compliant" ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="size-3.5" />
        SOLVENCY COMPLIANT ({solvency.solvencyRatioPercent})
      </span>
    ) : solvency?.status === "warning" ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <AlertTriangle className="size-3.5" />
        SOLVENCY WARNING ({solvency?.solvencyRatioPercent})
      </span>
    ) : solvency?.status === "payout_locked" ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
        <Lock className="size-3.5" />
        PAYOUT LOCKED (SUSPENSE DISCREPANCY)
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
        <XCircle className="size-3.5" />
        SOLVENCY CRITICAL ({solvency?.solvencyRatioPercent})
      </span>
    );

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/20 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Subtle Ambient Background Highlight matching Wallet hero */}
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs shrink-0">
            <Scale className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Owner Solvency &amp; Distributable Cash Telemetry
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Live mathematical governance enforcing 105% coverage multiplier and distributable cash cap
            </p>
          </div>
        </div>
        <div className="shrink-0">{statusBadge}</div>
      </div>

      {/* Metric Cards Grid matching Wallet Sub-metric Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {/* Cleared Cash */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span>Cleared Cash (1010+1020)</span>
            <Landmark className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-foreground">
            {solvency ? `${solvency.eligibleCashETB.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            CBE: {solvency?.cbeCashETB.toLocaleString()} | Telebirr: {solvency?.telebirrCashETB.toLocaleString()}
          </p>
        </div>

        {/* Total Obligations */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span>Total Liabilities (2010..2090)</span>
            <Coins className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-foreground">
            {solvency ? `${solvency.totalObligationsETB.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
            105% Multiplier: {solvency?.required105CoverageETB.toLocaleString()} ETB
          </p>
        </div>

        {/* Book Equity */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span>Book Equity (3010-3020)</span>
            <ShieldCheck className="size-4 text-purple-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {solvency ? `${solvency.bookEquityETB.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Net retained earnings less distributions &amp; reserve
          </p>
        </div>

        {/* Distributable Cap (Primary Highlight) */}
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-primary text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span>Distributable Cap</span>
            <Lock className="size-4 text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-primary">
            {solvency ? `${solvency.distributableCapETB.toLocaleString()} ETB` : "..."}
          </p>
          <p className="text-[11px] font-medium text-primary/80">
            min(BookEquity, CashSurplus)
          </p>
        </div>
      </div>

      {/* Float & Quarantine Exclusions Banner */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 backdrop-blur-xs relative z-10">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-primary shrink-0" />
          <span>
            <strong className="text-foreground font-semibold">Asset Isolation Policy:</strong> Provider Clearing Float (Account 1030:{" "}
            <span className="font-mono text-foreground font-semibold">
              {solvency ? `${solvency.providerClearingFloatETB.toLocaleString()} ETB` : "0"}
            </span>
            ) and Quarantined Balances (Account 1040:{" "}
            <span className="font-mono text-foreground font-semibold">
              {solvency ? `${solvency.quarantinedCbeBirrETB.toLocaleString()} ETB` : "0"}
            </span>
            ) are strictly excluded from eligible cleared cash.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLedgerInspector(!showLedgerInspector)}
          className="text-xs font-semibold text-primary hover:text-primary h-8 rounded-xl border-border/80 bg-card shadow-xs"
        >
          <FileText className="size-3.5 mr-1" />
          {showLedgerInspector ? "Hide Trial Balance" : "Inspect GL Trial Balance"}
        </Button>
      </div>

      {/* Expandable GL Trial Balance Inspector */}
      {showLedgerInspector && trialBalance && (
        <div className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden text-xs shadow-xs relative z-10">
          <div className="p-3.5 bg-muted/40 border-b border-border/70 font-semibold text-foreground flex items-center justify-between flex-wrap gap-2">
            <span>Chart of Accounts — General Ledger Trial Balance</span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Total Debits: {(trialBalance.totalDebitsSantims / 100).toFixed(2)} ETB | Total Credits:{" "}
              {(trialBalance.totalCreditsSantims / 100).toFixed(2)} ETB | Balanced:{" "}
              {trialBalance.isBalanced ? "✓ YES" : "✗ OUT OF BALANCE"}
            </span>
          </div>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-muted/20 border-b border-border/60 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Acc #</th>
                  <th className="p-2.5">Account Title</th>
                  <th className="p-2.5 text-right">Debits (ETB)</th>
                  <th className="p-2.5 text-right">Credits (ETB)</th>
                  <th className="p-2.5 text-right">Net Balance (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {trialBalance.accounts.map((acc: any) => (
                  <tr key={acc.accountNumber} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 text-primary font-bold">{acc.accountNumber}</td>
                    <td className="p-2.5 text-foreground">{acc.title}</td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {(acc.debitsSantims / 100).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {(acc.creditsSantims / 100).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-foreground">
                      {(acc.netBalanceSantims / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Owner Payout Request & Execution Controls */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 backdrop-blur-xs space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-foreground text-sm sm:text-base">
              Authorized Owner Capital Distribution Form
            </h3>
            <p className="text-xs text-muted-foreground">
              Two-step distribution protocol: Stage 1 Reservation (Debit 3020 / Credit 2090) &rarr; Stage 2 Bank Settlement (Debit 2090 / Credit 1010/1020)
            </p>
          </div>
          {activePayoutId && (
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold self-start sm:self-auto">
              Active Reservation: {activePayoutId}
            </span>
          )}
        </div>

        {!activePayoutId ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Payout Amount (ETB)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={payoutAmountEtb}
                onChange={(e) => setPayoutAmountEtb(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
              {isDistributableExceeded && (
                <p className="text-[10px] text-rose-500 mt-1 font-semibold">
                  Exceeds Distributable Cap ({solvency?.distributableCapETB.toFixed(2)} ETB)
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Destination Account Number / Phone
              </label>
              <input
                type="text"
                placeholder="e.g. 1000123456789 or +251 91 123 4567"
                value={destinationAccount}
                onChange={(e) => setDestinationAccount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleRequestPayout}
                disabled={
                  isSubmitting ||
                  amountEtbNum <= 0 ||
                  Boolean(isDistributableExceeded) ||
                  Boolean(isPostSolvencyViolated) ||
                  solvency?.status === "payout_locked"
                }
                className="w-full h-10 rounded-xl text-xs font-bold gap-1.5"
              >
                <Lock className="size-3.5" />
                Reserve Distribution
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-card/80">
            <p className="text-xs text-primary font-bold">
              Stage 2 Settlement: Enter independent Bank CBS Statement reference to complete disbursement
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Settlement Channel
                </label>
                <select
                  value={paymentChannel}
                  onChange={(e) => setPaymentChannel(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                >
                  <option value="cbe_a2a">Commercial Bank of Ethiopia (CBE)</option>
                  <option value="telebirr">Ethio Telecom Telebirr</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Bank Statement Voucher Ref *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBS-FT26301-XYZ or Telebirr Trans ID"
                  value={bankVoucherRef}
                  onChange={(e) => setBankVoucherRef(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={handleExecutePayout}
                  disabled={isSubmitting || !bankVoucherRef.trim()}
                  className="flex-1 h-10 rounded-xl text-xs font-bold gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  Execute Disbursement
                </Button>
                <Button
                  onClick={handleCancelPayout}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-10 rounded-xl text-xs font-semibold border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
