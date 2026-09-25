"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Copy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export function ChapaPaymentHistory() {
  const { isAuthenticated } = useConvexAuth();
  const queryFn = api.chapaPayments?.myPayments as any;
  const payments = useQuery(
    queryFn ?? "skip",
    isAuthenticated && queryFn ? {} : "skip"
  );

  if (!payments || payments.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4.5 text-purple-500" />
          <div>
            <h3 className="font-extrabold text-foreground text-sm sm:text-base">
              Chapa Payments
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Recent Chapa payment transactions
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60 max-h-[400px] overflow-y-auto">
        {payments.map((payment: any) => {
          const isSuccess = payment.status === "success";
          const isPending = payment.status === "pending";
          const isFailed = payment.status === "failed" || payment.status === "cancelled";

          return (
            <div
              key={payment._id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-muted/40 transition-all"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`rounded-2xl p-2.5 mt-0.5 shrink-0 ${
                    isSuccess
                      ? "bg-emerald-500/15 text-emerald-500"
                      : isPending
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  <CreditCard className="size-4.5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-foreground">
                      Chapa Payment
                    </span>
                    <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                      TEST
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {payment.txRef}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(payment.txRef);
                        toast.success("Copied!");
                      }}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(payment.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pl-12 sm:pl-0">
                <span className="text-base font-black text-foreground">
                  {payment.amount.toLocaleString()} {payment.currency}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    isSuccess
                      ? "bg-emerald-500/15 text-emerald-500"
                      : isPending
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {isSuccess && <CheckCircle2 className="size-3" />}
                  {isPending && <Clock className="size-3" />}
                  {isFailed && <XCircle className="size-3" />}
                  {payment.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
