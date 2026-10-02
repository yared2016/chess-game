"use client";

import { X, ArrowDownLeft, ArrowUpRight, Swords, ShieldCheck, Clock, CheckCircle2, AlertCircle, Copy, Check, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TransactionDetail {
  id: string;
  timestamp: number;
  type: string;
  entryType: string;
  isCredit: boolean;
  amountEtb: number;
  feeEtb: number;
  netEtb: number;
  status: "Completed" | "Locked" | "Processing" | "Failed" | "Reversed";
  method: string;
  reference: string;
  description: string;
}

interface TransactionDetailModalProps {
  transaction: TransactionDetail | null;
  onClose: () => void;
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const copyRef = () => {
    navigator.clipboard.writeText(transaction.reference);
    setCopied(true);
    toast.success("Reference copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const isDeposit = transaction.type.toLowerCase().includes("deposit");
  const isWithdrawal = transaction.type.toLowerCase().includes("withdraw");
  const isMatch = transaction.type.toLowerCase().includes("match");

  const formattedDate = new Date(transaction.timestamp).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "medium",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 transition-all animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-2xl font-bold border shadow-xs ${
                transaction.isCredit
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              {isDeposit && <ArrowDownLeft className="size-5" />}
              {isWithdrawal && <ArrowUpRight className="size-5" />}
              {isMatch && <Swords className="size-5" />}
              {!isDeposit && !isWithdrawal && !isMatch && <Receipt className="size-5" />}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Transaction Details
              </h2>
              <p className="text-xs text-muted-foreground">{transaction.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Main Status & Amount Card */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-center space-y-1.5">
          <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
            {transaction.isCredit ? "Credit Amount" : "Debit Amount"}
          </p>
          <div
            className={`text-3xl font-bold font-mono tracking-tight ${
              transaction.isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground"
            }`}
          >
            {transaction.isCredit ? "+" : "-"}
            {transaction.amountEtb.toFixed(2)} <span className="text-base font-sans font-semibold">ETB</span>
          </div>
          <div className="pt-1 flex items-center justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                transaction.status === "Completed"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  : transaction.status === "Processing" || transaction.status === "Locked"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              {transaction.status === "Completed" && <CheckCircle2 className="size-3.5" />}
              {(transaction.status === "Processing" || transaction.status === "Locked") && (
                <Clock className="size-3.5 animate-pulse" />
              )}
              {transaction.status === "Failed" && <AlertCircle className="size-3.5" />}
              {transaction.status}
            </span>
          </div>
        </div>

        {/* Itemized Breakdown List */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-mono font-semibold text-foreground">
              {transaction.isCredit ? "+" : "-"}
              {transaction.amountEtb.toFixed(2)} ETB
            </span>
          </div>

          {transaction.feeEtb > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Gateway / Service Fee</span>
              <span className="font-mono font-semibold text-muted-foreground">
                -{transaction.feeEtb.toFixed(2)} ETB
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Net Ledger Impact</span>
            <span className="font-mono font-bold text-foreground">
              {transaction.netEtb >= 0 ? "+" : ""}
              {transaction.netEtb.toFixed(2)} ETB
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-semibold text-foreground">{transaction.method}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Reference ID</span>
            <button
              onClick={copyRef}
              className="flex items-center gap-1.5 font-mono font-semibold text-foreground hover:text-primary transition-colors"
              title="Click to copy reference"
            >
              <span className="text-[11px] truncate max-w-[180px]">{transaction.reference}</span>
              {copied ? <Check className="size-3 text-emerald-500 shrink-0" /> : <Copy className="size-3 shrink-0 text-muted-foreground" />}
            </button>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Timestamp</span>
            <span className="text-right text-foreground font-medium text-[11px]">{formattedDate}</span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-muted-foreground">Description</span>
            <span className="text-right text-foreground font-medium text-[11px] max-w-[220px]">
              {transaction.description}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-muted py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
