"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  History,
  Lock,
  RefreshCw,
  ShieldAlert,
  Swords,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { formatEtb } from "@/lib/payments/money";

export function LedgerHistory() {
  const { isAuthenticated } = useConvexAuth();
  const entries = useQuery(api.ledger.myLedger, isAuthenticated ? { limit: 50 } : "skip");

  if (!entries || entries.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm space-y-0">
      <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="size-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-foreground text-sm sm:text-base">
              Financial Ledger
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Immutable journal of all wallet balance movements
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
          Double-Entry Verified
        </span>
      </div>

      <div className="divide-y divide-border/60 max-h-[460px] overflow-y-auto">
        {entries.map((entry: any) => {
          const isCredit =
            entry.entryType === "deposit_credit" ||
            entry.entryType === "match_payout" ||
            entry.entryType === "match_unlock" ||
            entry.entryType === "withdrawal_reversal";

          const isDebit =
            entry.entryType === "match_lock" ||
            entry.entryType === "match_loss" ||
            entry.entryType === "withdrawal_reserve" ||
            entry.entryType === "withdrawal_complete";

          const amountFormatted = formatEtb(entry.amountSantims);
          const balanceFormatted = formatEtb(entry.balanceAfterSantims);

          let icon = <Coins className="size-4" />;
          let iconBg = "bg-primary/10 text-primary";
          let label = "Financial Movement";

          switch (entry.entryType) {
            case "deposit_credit":
              icon = <CreditCard className="size-4" />;
              iconBg = "bg-emerald-500/15 text-emerald-500";
              label = "Deposit Credited";
              break;
            case "deposit_fee":
              icon = <CreditCard className="size-4" />;
              iconBg = "bg-purple-500/15 text-purple-400";
              label = "Provider Fee";
              break;
            case "match_lock":
              icon = <Lock className="size-4" />;
              iconBg = "bg-amber-500/15 text-amber-500";
              label = "Match Stake Locked";
              break;
            case "match_unlock":
              icon = <RefreshCw className="size-4" />;
              iconBg = "bg-blue-500/15 text-blue-400";
              label = "Stake Refunded";
              break;
            case "match_payout":
              icon = <Trophy className="size-4" />;
              iconBg = "bg-emerald-500/15 text-emerald-500";
              label = "Match Victory Payout";
              break;
            case "match_loss":
              icon = <Swords className="size-4" />;
              iconBg = "bg-destructive/15 text-destructive";
              label = "Match Defeat Stake";
              break;
            case "withdrawal_reserve":
              icon = <ArrowDownLeft className="size-4" />;
              iconBg = "bg-amber-500/15 text-amber-500";
              label = "Withdrawal Reserved";
              break;
            case "withdrawal_complete":
              icon = <CheckCircle2 className="size-4" />;
              iconBg = "bg-emerald-500/15 text-emerald-500";
              label = "Withdrawal Completed";
              break;
            case "withdrawal_reversal":
              icon = <RefreshCw className="size-4" />;
              iconBg = "bg-blue-500/15 text-blue-400";
              label = "Withdrawal Refunded";
              break;
            case "platform_commission":
              icon = <Coins className="size-4" />;
              iconBg = "bg-purple-500/15 text-purple-400";
              label = "Platform Commission";
              break;
          }

          return (
            <div
              key={entry._id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-muted/40 transition-all"
            >
              <div className="flex items-start gap-3.5">
                <div className={`rounded-2xl p-2.5 mt-0.5 shrink-0 ${iconBg}`}>
                  {icon}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-foreground">{label}</span>
                    <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-mono text-muted-foreground uppercase">
                      {entry.referenceType}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Ref: {entry.referenceId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(entry.referenceId);
                        toast.success("Copied reference!");
                      }}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                      title="Copy Reference"
                    >
                      <Copy className="size-2.5" />
                    </button>
                    <span className="text-[10px] text-muted-foreground/60">•</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 pl-12 sm:pl-0">
                <span
                  className={`text-sm font-black font-mono ${
                    isCredit
                      ? "text-emerald-500"
                      : isDebit
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {isCredit ? "+" : isDebit ? "-" : ""}
                  {amountFormatted}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Balance: {balanceFormatted}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
