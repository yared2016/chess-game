"use client";

import { X, ArrowDownLeft, ArrowUpRight, Swords, ShieldCheck, Clock, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { useState } from "react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-10 items-center justify-center rounded-2xl font-bold ${
                transaction.isCredit
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-rose-500/15 text-rose-500"
              }`}
            >
              {isDeposit && <ArrowDownLeft className="size-5" />}
              {isWithdrawal && <ArrowUpRight className="size-5" />}
              {isMatch && <Swords className="size-5" />}
              {!isDeposit && !isWithdrawal && !isMatch && <ShieldCheck className="size-5" />}
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Transaction Details
              </h2>
              <p className="text-xs text-muted-foreground">{transaction.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Main Status & Amount Card */}
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center space-y-1">
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            {transaction.isCredit ? "Amount Credited" : "Amount Deducted"}
          </p>
          <div
            className={`text-3xl font-black font-mono tracking-tight ${
              transaction.isCredit ? "text-emerald-500" : "text-foreground"
            }`}
          >
            {transaction.isCredit ? "+" : "-"}
            {transaction.amountEtb.toFixed(2)} ETB
          </div>
          <div className="pt-2 flex items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                transaction.status === "Completed"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : transaction.status === "Processing" || transaction.status === "Locked"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {transaction.status === "Completed" && <CheckCircle2 className="size-3.5" />}
              {transaction.status === "Processing" && <Clock className="size-3.5" />}
              {transaction.status === "Locked" && <Clock className="size-3.5" />}
              {transaction.status === "Failed" && <AlertCircle className="size-3.5" />}
              {transaction.status}
            </span>
          </div>
        </div>

        {/* Itemized Breakdown List */}
        <div className="space-y-2.5 text-xs">
          {isDeposit && (
            <>
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Wallet Credit</span>
                <span className="font-mono font-bold text-foreground">
                  +{transaction.amountEtb.toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Chapa Fee (2.6% VAT incl.)</span>
                <span className="font-mono font-bold text-muted-foreground">
                  {(transaction.amountEtb * 0.026).toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/40 font-bold">
                <span className="text-foreground">Total Paid at Checkout</span>
                <span className="font-mono text-foreground">
                  {(transaction.amountEtb * 1.026).toFixed(2)} ETB
                </span>
              </div>
            </>
          )}

          {isWithdrawal && (
            <>
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Received by User</span>
                <span className="font-mono font-bold text-foreground">
                  {transaction.amountEtb.toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Chapa Fee (2.6% VAT incl.)</span>
                <span className="font-mono font-bold text-muted-foreground">
                  {(transaction.amountEtb * 0.026).toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/40 font-bold">
                <span className="text-foreground">Total Wallet Liability Deducted</span>
                <span className="font-mono text-foreground">
                  {(transaction.amountEtb * 1.026).toFixed(2)} ETB
                </span>
              </div>
            </>
          )}

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-bold text-foreground">{transaction.method}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Reference Code</span>
            <button
              onClick={copyRef}
              className="flex items-center gap-1.5 font-mono font-bold text-foreground hover:text-amber-500 transition-colors"
            >
              <span>{transaction.reference}</span>
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            </button>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Date & Time</span>
            <span className="text-right text-foreground font-medium">{formattedDate}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Description</span>
            <span className="text-right text-foreground font-medium">{transaction.description}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-muted py-2.5 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
