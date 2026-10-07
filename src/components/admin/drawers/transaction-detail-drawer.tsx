"use client";

import React, { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Swords,
  Receipt,
  Copy,
  Check,
  User,
  CreditCard,
  Hash,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { DetailDrawer, StatusBadge } from "@/components/admin/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/ui";
import { cn } from "@/lib/utils";

export interface TransactionDetailDrawerProps {
  transaction: any | null;
  isOpen: boolean;
  onClose: () => void;
  onInspectPlayer?: (playerId: string) => void;
}

export function TransactionDetailDrawer({
  transaction,
  isOpen,
  onClose,
  onInspectPlayer,
}: TransactionDetailDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  if (!transaction) {
    return (
      <DetailDrawer
        isOpen={isOpen}
        onClose={onClose}
        title="Transaction Details"
        subtitle="Loading receipt..."
      >
        <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
          No transaction selected.
        </div>
      </DetailDrawer>
    );
  }

  const copyToClipboard = (text: string, label: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Field extraction with multi-source fallback (ledger, deposit, withdrawal, unified)
  const txId = transaction.id || transaction._id || "N/A";
  const rawType = (
    transaction.type ||
    transaction.entryType ||
    transaction.referenceType ||
    "Transaction"
  ).toString();

  const isDeposit =
    rawType.toLowerCase().includes("deposit") ||
    rawType.toLowerCase() === "credit";
  const isWithdrawal =
    rawType.toLowerCase().includes("withdraw") ||
    rawType.toLowerCase() === "debit";
  const isMatch =
    rawType.toLowerCase().includes("match") ||
    rawType.toLowerCase().includes("stake") ||
    rawType.toLowerCase().includes("payout");

  const isCredit =
    transaction.isCredit ??
    (transaction.entryType === "credit" ||
      isDeposit ||
      rawType.toLowerCase().includes("payout"));

  // Amount parsing
  const rawAmount =
    transaction.amountEtb ??
    (transaction.amountSantims !== undefined
      ? transaction.amountSantims / 100
      : transaction.amount ?? 0);
  const amountEtb = typeof rawAmount === "number" ? rawAmount : parseFloat(rawAmount) || 0;

  // Fee parsing
  const rawFee =
    transaction.feeEtb ??
    (transaction.providerFeeSantims !== undefined
      ? transaction.providerFeeSantims / 100
      : transaction.fee ?? 0);
  const feeEtb = typeof rawFee === "number" ? rawFee : parseFloat(rawFee) || 0;

  // Net calculation
  const rawNet =
    transaction.netEtb ??
    transaction.netAmountEtb ??
    (isCredit ? amountEtb - feeEtb : -(amountEtb + feeEtb));
  const netEtb = typeof rawNet === "number" ? rawNet : parseFloat(rawNet) || 0;

  // Status
  const status = transaction.status || (isCredit ? "Completed" : "Completed");

  // Identifiers
  const referenceId =
    transaction.reference ||
    transaction.referenceId ||
    transaction.txRef ||
    transaction.internalTxRef ||
    txId;
  const providerRef =
    transaction.providerRef ||
    transaction.chapaRef ||
    transaction.providerTxId ||
    transaction.providerReference ||
    null;
  const idempotencyKey =
    transaction.idempotencyKey || transaction.idempotency_key || null;

  // Payment method & channel
  const method =
    transaction.method ||
    transaction.provider ||
    transaction.payoutMethod ||
    transaction.channel ||
    (isMatch ? "Match Pot Escrow" : "Chapa Gateway");

  // Player / User info
  const username =
    transaction.username ||
    transaction.playerName ||
    transaction.user?.username ||
    "Player";
  const playerId =
    transaction.userId ||
    transaction.playerId ||
    transaction.user?._id ||
    transaction.user?.id ||
    null;
  const avatarUrl =
    transaction.userAvatarUrl ||
    transaction.avatarUrl ||
    transaction.user?.avatarUrl;

  // Timestamp
  const timestamp =
    transaction.timestamp ||
    transaction.createdAt ||
    transaction._creationTime ||
    0;
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "medium",
      })
    : "Unknown date";

  const description =
    transaction.description ||
    `${rawType} of ${amountEtb.toFixed(2)} ETB via ${method}`;

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Receipt"
      subtitle={`Ref: ${referenceId.slice(0, 16)}`}
      className="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-border/80 bg-muted/60 px-5 py-2 text-xs font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all"
          >
            Close Receipt
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl border shadow-xs",
                  isCredit
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}
              >
                {isDeposit && <ArrowDownLeft className="size-5" />}
                {isWithdrawal && <ArrowUpRight className="size-5" />}
                {isMatch && <Swords className="size-5" />}
                {!isDeposit && !isWithdrawal && !isMatch && <Receipt className="size-5" />}
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {rawType.replace(/_/g, " ")}
                </p>
                <h3 className="text-sm font-bold text-foreground">
                  Structured Financial Entry
                </h3>
              </div>
            </div>
            <StatusBadge status={status} size="md" />
          </div>

          {/* Amount Display */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isCredit ? "Credit Ledger Impact" : "Debit Ledger Impact"}
            </p>
            <div
              className={cn(
                "text-3xl font-black font-mono tabular-nums tracking-tight",
                isCredit
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              )}
            >
              {isCredit ? "+" : "-"}
              {amountEtb.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-sm font-sans font-bold text-muted-foreground">
                ETB
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto truncate">
              {description}
            </p>
          </div>
        </div>

        {/* Player Context Bar */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-9 border border-border/80">
              <AvatarImage src={avatarUrl} alt={username} />
              <AvatarFallback className="text-xs font-bold bg-muted">
                {initials(username)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {username}
              </p>
              {playerId && (
                <p className="text-[10px] font-mono text-muted-foreground truncate">
                  ID: {playerId}
                </p>
              )}
            </div>
          </div>
          {playerId && onInspectPlayer && (
            <button
              type="button"
              onClick={() => onInspectPlayer(playerId)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0"
            >
              <User className="size-3.5" />
              <span>Inspect Player</span>
            </button>
          )}
        </div>

        {/* Fee & Ledger Breakdown */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <Layers className="size-4 text-muted-foreground" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ledger Accounting Breakdown
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross Amount:</span>
              <span className="font-mono tabular-nums font-bold text-foreground">
                {amountEtb.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ETB
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gateway / Provider Fee:</span>
              <span className="font-mono tabular-nums font-semibold text-muted-foreground">
                {feeEtb > 0 ? `-${feeEtb.toFixed(2)} ETB` : "0.00 ETB (Included)"}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="font-semibold text-foreground">Net Balance Impact:</span>
              <span
                className={cn(
                  "font-mono tabular-nums font-black",
                  netEtb >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {netEtb >= 0 ? "+" : ""}
                {netEtb.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ETB
              </span>
            </div>
          </div>
        </div>

        {/* Payment Channel & Timing */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Channel & Method
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Method / Channel:</span>
              <span className="font-bold text-foreground capitalize">
                {method}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Timestamp:</span>
              <span className="font-medium text-foreground text-right text-[11px]">
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Identifiers & Audit Hashes */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <Hash className="size-4 text-muted-foreground" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identifiers & Idempotency
            </h4>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Reference ID */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Reference ID:</span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(referenceId, "Reference ID", "ref")
                }
                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground hover:text-primary transition-colors max-w-[260px] truncate"
                title="Copy reference ID"
              >
                <span className="truncate">{referenceId}</span>
                {copiedKey === "ref" ? (
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Copy className="size-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            </div>

            {/* Provider / Chapa Reference ID */}
            {providerRef && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">
                  Provider Ref:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(providerRef, "Provider Reference", "prov")
                  }
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground hover:text-primary transition-colors max-w-[260px] truncate"
                  title="Copy provider reference"
                >
                  <span className="truncate">{providerRef}</span>
                  {copiedKey === "prov" ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>
              </div>
            )}

            {/* Idempotency Key */}
            {idempotencyKey && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">
                  Idempotency Key:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(idempotencyKey, "Idempotency Key", "idem")
                  }
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground hover:text-primary transition-colors max-w-[260px] truncate"
                  title="Copy idempotency key"
                >
                  <span className="truncate">{idempotencyKey}</span>
                  {copiedKey === "idem" ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}
