"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DepositModal } from "./deposit-modal";
import { WithdrawModal } from "./withdraw-modal";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Crown,
  Hash,
  Info,
  Loader2,
  Lock,
  Percent,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trophy,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  calculateDepositFee,
  calculateWithdrawalFee,
  formatEtb,
  toSantims,
  toEtb,
  getChapaFeeRatePercent,
} from "@/lib/payments/money";
import type { BankInfo } from "@/lib/payments/types";

export function WalletView() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const balance = useQuery(api.wallets?.getBalance as any, isAuthenticated ? {} : "skip");
  const walletDoc = useQuery(api.wallets?.getOrCreate as any, isAuthenticated ? {} : "skip");
  const deposits = useQuery(api.financial?.deposits?.myDeposits as any, isAuthenticated ? {} : "skip");
  const withdrawals = useQuery(api.financial?.withdrawals?.myWithdrawals as any, isAuthenticated ? {} : "skip");
  const ledgerEntries = useQuery(api.ledger?.myLedger as any, isAuthenticated ? { limit: 50 } : "skip");
  const ensureWallet = useMutation(api.wallets?.ensureWallet as any);

  // Modal states (optional popup triggers from quick actions)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Inline Deposit Form State
  const [depositAmountEtb, setDepositAmountEtb] = useState<number>(1000);
  const [depositInput, setDepositInput] = useState<string>("1000");
  const [isDepositLoading, setIsDepositLoading] = useState(false);

  // Inline Withdraw Form State
  const [withdrawMethod, setWithdrawMethod] = useState<"telebirr" | "bank">("telebirr");
  const [withdrawAmountEtb, setWithdrawAmountEtb] = useState<number>(500);
  const [withdrawInput, setWithdrawInput] = useState<string>("500");
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("855"); // Telebirr default
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountHolderName, setAccountHolderName] = useState<string>("");
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  // Table Filter State
  const [historyFilter, setHistoryFilter] = useState<"all" | "deposits" | "withdrawals" | "matches">("all");

  const feePercent = getChapaFeeRatePercent(); // 2.6%
  const searchParams = useSearchParams();
  const verifyRef = searchParams?.get("verifyRef");

  // Ensure user wallet exists on auth
  useEffect(() => {
    if (isAuthenticated) {
      ensureWallet().catch(console.error);
    }
  }, [isAuthenticated, ensureWallet]);

  // Load supported banks for withdrawal
  useEffect(() => {
    let isSubscribed = true;
    fetch("/api/finance/banks")
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        if (data.banks && Array.isArray(data.banks)) {
          setBanks(data.banks);
        }
      })
      .catch((err) => console.error("Failed to load banks:", err))
      .finally(() => {
        if (isSubscribed) setIsLoadingBanks(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Handle return verification from Chapa checkout
  useEffect(() => {
    if (verifyRef && isAuthenticated) {
      toast.info("Verifying your deposit with Chapa...");
      fetch("/api/finance/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalTxRef: verifyRef }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") {
            toast.success(`Deposit of ${data.creditEtb} ETB verified & credited! 🎉`);
            window.history.replaceState({}, "", window.location.pathname);
          } else if (data.status === "failed") {
            toast.error("Deposit verification failed. No charges made.");
          }
        })
        .catch((err) => console.error("Verify return error:", err));
    }
  }, [verifyRef, isAuthenticated]);

  // Financial calculations
  const availableEtb = balance?.available ?? (walletDoc?.availableSantims ? walletDoc.availableSantims / 100 : 0);
  const lockedEtb = balance?.locked ?? (walletDoc?.lockedSantims ? walletDoc.lockedSantims / 100 : 0);
  const totalEtb = availableEtb + lockedEtb;

  // Deposit fee calculation
  const depositSantims = toSantims(depositAmountEtb > 0 ? depositAmountEtb : 0);
  const depositFeeCalc = calculateDepositFee(depositSantims > 0 ? depositSantims : 100000);

  // Withdrawal fee calculation
  const withdrawSantims = toSantims(withdrawAmountEtb > 0 ? withdrawAmountEtb : 0);
  const withdrawFeeCalc = calculateWithdrawalFee(withdrawSantims > 0 ? withdrawSantims : 50000);
  const totalWithdrawalRequired = withdrawFeeCalc.totalDeductionSantims / 100;
  const hasSufficientFunds = availableEtb >= totalWithdrawalRequired;

  // Active bank code based on method
  const effectiveBankCode = withdrawMethod === "telebirr" ? "855" : selectedBank;
  const selectedBankObj = banks.find((b) => b.code === effectiveBankCode);

  // Inline Deposit Handler
  async function handleDepositSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (depositAmountEtb < 10) {
      toast.error("Minimum deposit is 10 ETB");
      return;
    }

    setIsDepositLoading(true);
    try {
      const res = await fetch("/api/finance/deposit/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEtb: depositAmountEtb }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Deposit initialization failed");
      }

      if (data.checkoutUrl) {
        toast.info("Redirecting to Chapa secure checkout...");
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned from provider");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate deposit");
      setIsDepositLoading(false);
    }
  }

  // Inline Withdrawal Handler
  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (withdrawAmountEtb < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (!hasSufficientFunds) {
      toast.error(`Insufficient balance. You need ${totalWithdrawalRequired.toFixed(2)} ETB including fee.`);
      return;
    }
    if (!accountNumber.trim() || !accountHolderName.trim()) {
      toast.error("Please fill in recipient account number and name");
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/\s/g, "");

    if (withdrawMethod === "telebirr") {
      if (!/^(09|07|\+2519|\+2517)\d{8}$/.test(cleanAcc) && cleanAcc.length !== 10) {
        toast.error("Telebirr phone number must be 10 digits (e.g. 0912345678)");
        return;
      }
    } else {
      if (selectedBankObj?.acctLength && cleanAcc.length !== selectedBankObj.acctLength) {
        toast.error(
          `${selectedBankObj.name} account number must be exactly ${selectedBankObj.acctLength} digits.`
        );
        return;
      }
    }

    const bankName =
      withdrawMethod === "telebirr"
        ? "telebirr"
        : (selectedBankObj ? selectedBankObj.name : "Bank Transfer");

    setIsWithdrawLoading(true);
    try {
      const res = await fetch("/api/finance/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountEtb: withdrawAmountEtb,
          bankName,
          bankCode: effectiveBankCode,
          accountNumber: cleanAcc,
          accountHolderName: accountHolderName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      toast.success("Withdrawal initiated! Funds reserved & queued with Chapa.");
      setAccountNumber("");
      setAccountHolderName("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate withdrawal");
    } finally {
      setIsWithdrawLoading(false);
    }
  }

  // Unified Transactions for History Table
  const unifiedTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      type: "deposit" | "withdrawal" | "match_entry" | "match_win" | "other";
      typeName: string;
      amountEtb: number;
      feeEtb: number;
      netEtb: number;
      status: "completed" | "locked" | "processing" | "failed" | "reversed";
      createdAt: number;
      reference: string;
    }> = [];

    // From deposits
    (deposits || []).forEach((d: any) => {
      const isCompleted = d.status === "credited" || d.status === "verified";
      const isFailed = d.status === "failed" || d.status === "expired";
      list.push({
        id: d._id,
        type: "deposit",
        typeName: "Deposit",
        amountEtb: d.grossAmountSantims ? d.grossAmountSantims / 100 : d.requestedCreditSantims / 100,
        feeEtb: d.providerFeeSantims ? d.providerFeeSantims / 100 : 0,
        netEtb: d.requestedCreditSantims / 100,
        status: isCompleted ? "completed" : isFailed ? "failed" : "processing",
        createdAt: d.createdAt,
        reference: d.internalTxRef || `DEP_${d._id.slice(-6)}`,
      });
    });

    // From withdrawals
    (withdrawals || []).forEach((w: any) => {
      const isCompleted = w.status === "completed";
      const isFailed = w.status === "failed" || w.status === "reversed";
      const isProcessing = w.status === "processing" || w.status === "reserved" || w.status === "provider_submitted";
      list.push({
        id: w._id,
        type: "withdrawal",
        typeName: "Withdrawal",
        amountEtb: -(w.requestedAmountSantims / 100),
        feeEtb: w.providerFeeSantims ? w.providerFeeSantims / 100 : 0,
        netEtb: -((w.totalReservedSantims || w.requestedAmountSantims) / 100),
        status: isCompleted ? "completed" : isProcessing ? "processing" : "reversed",
        createdAt: w.createdAt,
        reference: w.internalTransferRef || `WDR_${w._id.slice(-6)}`,
      });
    });

    // From match stakes and winnings in ledger (if available)
    (ledgerEntries || []).forEach((entry: any) => {
      if (entry.entryType === "match_lock") {
        list.push({
          id: entry._id,
          type: "match_entry",
          typeName: "Match Entry",
          amountEtb: -(entry.amountSantims / 100),
          feeEtb: 0,
          netEtb: -(entry.amountSantims / 100),
          status: "locked",
          createdAt: entry.createdAt,
          reference: entry.referenceId || `MATCH_${entry._id.slice(-6)}`,
        });
      } else if (entry.entryType === "match_payout") {
        list.push({
          id: entry._id,
          type: "match_win",
          typeName: "Match Winnings",
          amountEtb: entry.amountSantims / 100,
          feeEtb: 0,
          netEtb: entry.amountSantims / 100,
          status: "completed",
          createdAt: entry.createdAt,
          reference: entry.referenceId || `WIN_${entry._id.slice(-6)}`,
        });
      }
    });

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [deposits, withdrawals, ledgerEntries]);

  // Filtered transactions for table
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter((tx) => {
      if (historyFilter === "deposits") return tx.type === "deposit";
      if (historyFilter === "withdrawals") return tx.type === "withdrawal";
      if (historyFilter === "matches") return tx.type === "match_entry" || tx.type === "match_win";
      return true;
    });
  }, [unifiedTransactions, historyFilter]);

  // Recent activity list (top 5)
  const recentActivities = useMemo(() => {
    return unifiedTransactions.slice(0, 5);
  }, [unifiedTransactions]);

  if (balance === undefined && isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Loading Wallet Portfolio...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 space-y-6 text-foreground font-sans">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Wallet
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your funds, make deposits, and withdraw your earnings.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-border/80 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Secure & Trusted</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="font-bold text-foreground">Powered by Chapa</span>
        </div>
      </div>

      {/* 2. Top Hero Balance Card with 3D Chess King Graphic */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-card/70 p-6 sm:p-7 shadow-sm dark:border-border/60 dark:bg-[#0B0F17]">
        {/* Subtle chessboard grid background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            {/* Available Balance */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl border border-border/60 bg-background/50 dark:bg-zinc-900/40">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                <Wallet className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Available Balance
                </p>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {availableEtb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ready to use</span>
                </div>
              </div>
            </div>

            {/* Locked Balance */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl border border-border/60 bg-background/50 dark:bg-zinc-900/40">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                <Lock className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Locked Balance
                </p>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {lockedEtb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </p>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  In active matches
                </p>
              </div>
            </div>

            {/* Total Balance */}
            <div className="flex items-start gap-3.5 p-4 rounded-2xl border border-border/60 bg-background/50 dark:bg-zinc-900/40">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                <Coins className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total Balance
                </p>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {totalEtb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                </p>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Available + Locked
                </p>
              </div>
            </div>
          </div>

          {/* Chess King Visual Badge on Right */}
          <div className="hidden lg:flex items-center justify-center pr-4">
            <div className="relative flex items-center justify-center size-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-inner">
              <Crown className="size-10 stroke-[1.75]" />
              <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-card border border-border text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                Chess ETB
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Grid Layout: Deposit Card, Withdraw Card, and Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Deposit Funds (lg:col-span-4) */}
        <div className="lg:col-span-4 rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5 dark:border-border/60 dark:bg-[#0B0F17]">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 shrink-0">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight text-foreground">
                Deposit Funds
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Add money to your wallet using Chapa. {feePercent}% transaction fee (including VAT) applies.
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-b border-border/40 pb-3">
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black">
                1
              </span>
              Amount
            </span>
            <span className="h-0.5 w-6 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
                2
              </span>
              Payment
            </span>
            <span className="h-0.5 w-6 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
                3
              </span>
              Complete
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleDepositSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                How much would you like to add?
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="100000"
                  value={depositInput}
                  onChange={(e) => {
                    setDepositInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    setDepositAmountEtb(!isNaN(val) && val > 0 ? val : 0);
                  }}
                  placeholder="1,000.00"
                  className="w-full h-12 px-4 pr-14 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <span className="absolute right-4 top-3.5 text-xs font-black text-muted-foreground">
                  ETB
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 2500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDepositAmountEtb(preset);
                    setDepositInput(String(preset));
                  }}
                  className={`py-1.5 text-xs font-black rounded-xl border transition-all ${
                    depositAmountEtb === preset
                      ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-xs"
                      : "border-border/80 bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>

            {/* Clear 2.6% Fee Breakdown */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Wallet credit</span>
                <span className="font-mono font-bold text-foreground">
                  {formatEtb(depositFeeCalc.walletCreditSantims)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Chapa fee ({feePercent}%)</span>
                <span className="font-mono font-bold text-foreground">
                  {formatEtb(depositFeeCalc.providerFeeSantims)}
                </span>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
                <span className="text-foreground">Total payment</span>
                <span className="font-mono text-amber-500">
                  {formatEtb(depositFeeCalc.grossPaymentSantims)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              You will be redirected to Chapa to complete your payment.
            </p>

            <Button
              type="submit"
              disabled={isDepositLoading || depositAmountEtb < 10}
              className="w-full h-12 rounded-2xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs"
            >
              {isDepositLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-zinc-950" />
                  Connecting to Chapa...
                </>
              ) : (
                <>
                  Continue to Chapa
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Column 2: Withdraw Funds (lg:col-span-4) */}
        <div className="lg:col-span-4 rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5 dark:border-border/60 dark:bg-[#0B0F17]">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 shrink-0">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight text-foreground">
                Withdraw Funds
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Transfer your funds to Telebirr or your bank account. {feePercent}% transaction fee (including VAT) applies.
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-b border-border/40 pb-3">
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black">
                1
              </span>
              Amount
            </span>
            <span className="h-0.5 w-6 bg-border" />
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black">
                2
              </span>
              Destination
            </span>
            <span className="h-0.5 w-6 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
                3
              </span>
              Confirm
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Amount to receive
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="50"
                  max="100000"
                  value={withdrawInput}
                  onChange={(e) => {
                    setWithdrawInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    setWithdrawAmountEtb(!isNaN(val) && val > 0 ? val : 0);
                  }}
                  placeholder="500.00"
                  className="w-full h-12 px-4 pr-14 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <span className="absolute right-4 top-3.5 text-xs font-black text-muted-foreground">
                  ETB
                </span>
              </div>
            </div>

            {/* Destination Toggle */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Withdraw to
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/30 border border-border/60">
                <button
                  type="button"
                  onClick={() => setWithdrawMethod("telebirr")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    withdrawMethod === "telebirr"
                      ? "bg-amber-500 text-zinc-950 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="size-4" />
                  Telebirr
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawMethod("bank");
                    if (banks.length > 0 && selectedBank === "855") {
                      const firstNonTele = banks.find((b) => b.code !== "855");
                      if (firstNonTele) setSelectedBank(firstNonTele.code);
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    withdrawMethod === "bank"
                      ? "bg-amber-500 text-zinc-950 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="size-4" />
                  Bank Account
                </button>
              </div>
            </div>

            {/* Dynamic Bank Fields */}
            {withdrawMethod === "bank" && (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Select Destination Bank
                </label>
                {isLoadingBanks ? (
                  <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border/80 bg-muted/20 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-amber-500" />
                    <span>Loading supported banks...</span>
                  </div>
                ) : (
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {banks
                      .filter((b) => b.code !== "855")
                      .map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} {b.acctLength ? `(${b.acctLength} digits)` : ""}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {withdrawMethod === "telebirr" ? "Telebirr Phone Number" : "Account Number"}
                </label>
                {withdrawMethod === "bank" && selectedBankObj?.acctLength && (
                  <span className="text-[11px] text-amber-500 font-semibold">
                    {selectedBankObj.acctLength} digits required
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder={
                    withdrawMethod === "telebirr"
                      ? "e.g. 0912345678 or 07..."
                      : selectedBankObj?.acctLength
                        ? `Enter ${selectedBankObj.acctLength}-digit account`
                        : "Account number"
                  }
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {withdrawMethod === "telebirr" ? (
                  <Phone className="size-4 text-muted-foreground absolute left-3 top-3.5" />
                ) : (
                  <Hash className="size-4 text-muted-foreground absolute left-3 top-3.5" />
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Account Holder Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Full name as registered on account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <User className="size-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
            </div>

            {/* Fee & Deduction Breakdown */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Amount to receive</span>
                <span className="font-mono font-bold text-foreground">
                  {formatEtb(withdrawFeeCalc.userReceivesSantims)}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Chapa fee ({feePercent}%)</span>
                <span className="font-mono font-bold text-foreground">
                  {formatEtb(withdrawFeeCalc.providerFeeSantims)}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
                <span className="text-foreground">Total wallet deduction</span>
                <span
                  className={`font-mono ${
                    hasSufficientFunds ? "text-amber-500" : "text-destructive"
                  }`}
                >
                  {formatEtb(withdrawFeeCalc.totalDeductionSantims)}
                </span>
              </div>
            </div>

            {!hasSufficientFunds && (
              <p className="text-xs text-destructive font-bold text-center">
                Insufficient available balance for this withdrawal and fee.
              </p>
            )}

            <Button
              type="submit"
              disabled={isWithdrawLoading || !hasSufficientFunds || withdrawAmountEtb < 50}
              className="w-full h-12 rounded-2xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs"
            >
              {isWithdrawLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-zinc-950" />
                  Dispatching Chapa Payout...
                </>
              ) : (
                <>
                  Confirm Withdrawal
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Column 3: Sidebar Widgets (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="flex items-center justify-between p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold transition-all shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950/15">
                  <CreditCard className="size-5 text-zinc-950" />
                </span>
                <div className="text-left">
                  <p className="text-sm font-black">Deposit</p>
                  <p className="text-[11px] font-semibold opacity-80">Add funds to your wallet</p>
                </div>
              </div>
              <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted text-foreground font-bold transition-all shadow-xs group dark:border-border/60 dark:bg-[#0B0F17]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                  <ArrowDownLeft className="size-5 text-amber-500" />
                </span>
                <div className="text-left">
                  <p className="text-sm font-black">Withdraw</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">Transfer to Telebirr or Bank</p>
                </div>
              </div>
              <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Configurable Fee Information Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3 dark:border-border/60 dark:bg-[#0B0F17]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Percent className="size-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Transaction Fee (Chapa)
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">
                {feePercent}%
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                (including VAT)
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
              <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                The fee is configurable. If Chapa updates its fee, we will adjust it accordingly.
              </span>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4 dark:border-border/60 dark:bg-[#0B0F17]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground">Recent Activity</h3>
              <button
                onClick={() => {
                  const el = document.getElementById("transaction-history-table");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-bold text-amber-500 hover:underline inline-flex items-center gap-1"
              >
                View all <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No recent activity found.
                </p>
              ) : (
                recentActivities.map((act) => {
                  const isPositive = act.amountEtb > 0;
                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-8 items-center justify-center rounded-xl text-xs font-bold ${
                            act.type === "deposit"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : act.type === "match_win"
                                ? "bg-amber-500/15 text-amber-500"
                                : act.type === "match_entry"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-orange-500/15 text-orange-500"
                          }`}
                        >
                          {act.type === "deposit" ? (
                            <CheckCircle2 className="size-4" />
                          ) : act.type === "match_win" ? (
                            <Trophy className="size-4" />
                          ) : act.type === "match_entry" ? (
                            <Lock className="size-4" />
                          ) : (
                            <Clock className="size-4" />
                          )}
                        </span>
                        <div>
                          <p className="text-xs font-black text-foreground leading-tight">
                            {act.typeName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span
                              className={`inline-block size-1.5 rounded-full ${
                                act.status === "completed"
                                  ? "bg-emerald-500"
                                  : act.status === "locked"
                                    ? "bg-amber-500"
                                    : act.status === "processing"
                                      ? "bg-orange-500"
                                      : "bg-destructive"
                              }`}
                            />
                            <span className="capitalize">{act.status}</span>
                            <span>•</span>
                            <span>{new Date(act.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-black font-mono ${
                          isPositive ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {isPositive ? `+${act.amountEtb.toFixed(0)} ETB` : `${act.amountEtb.toFixed(0)} ETB`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Promo Card: Play More, Earn More */}
          <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-card to-amber-500/10 p-5 shadow-sm space-y-3 dark:border-amber-500/30 dark:bg-[#0B0F17]">
            <div className="flex items-center gap-2 text-amber-500">
              <Crown className="size-5" />
              <h4 className="text-sm font-black text-foreground">Play More, Earn More</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use your wallet to join paid tournaments, win matches and grow your balance.
            </p>
            <Link
              href="/play"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/80 bg-background hover:bg-muted text-xs font-black text-foreground transition-all shadow-xs"
            >
              Explore Tournaments <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Full-Width Transaction History Table */}
      <div
        id="transaction-history-table"
        className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4 dark:border-border/60 dark:bg-[#0B0F17]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-lg font-black text-foreground">Transaction History</h3>
            <p className="text-xs text-muted-foreground">
              View all your wallet transactions and their current status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value as any)}
              className="h-10 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Transactions</option>
              <option value="deposits">Deposits</option>
              <option value="withdrawals">Withdrawals</option>
              <option value="matches">Match Entries & Winnings</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Fee</th>
                <th className="py-3 px-3">Net</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No transactions recorded under this filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPositive = tx.netEtb > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${
                              tx.type === "deposit"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : tx.type === "match_win"
                                  ? "bg-amber-500/15 text-amber-500"
                                  : tx.type === "match_entry"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-orange-500/15 text-orange-500"
                            }`}
                          >
                            {tx.type === "deposit" ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : tx.type === "match_win" ? (
                              <Trophy className="size-3.5" />
                            ) : tx.type === "match_entry" ? (
                              <Lock className="size-3.5" />
                            ) : (
                              <ArrowDownLeft className="size-3.5" />
                            )}
                          </span>
                          <span className="font-bold text-foreground">{tx.typeName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold">
                        <span className={tx.amountEtb > 0 ? "text-emerald-500" : "text-foreground"}>
                          {tx.amountEtb > 0 ? `+${tx.amountEtb.toFixed(2)} ETB` : `${tx.amountEtb.toFixed(2)} ETB`}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-muted-foreground">
                        {tx.feeEtb > 0 ? `${tx.feeEtb.toFixed(2)} ETB` : "—"}
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold">
                        <span className={isPositive ? "text-emerald-500" : "text-destructive"}>
                          {isPositive ? `+${tx.netEtb.toFixed(2)} ETB` : `${tx.netEtb.toFixed(2)} ETB`}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold capitalize ${
                            tx.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                              : tx.status === "locked"
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                : tx.status === "processing"
                                  ? "bg-orange-500/15 text-orange-500 border border-orange-500/30"
                                  : "bg-destructive/15 text-destructive border border-destructive/30"
                          }`}
                        >
                          {tx.status === "completed" ? (
                            <CheckCircle2 className="size-3" />
                          ) : tx.status === "locked" ? (
                            <Lock className="size-3" />
                          ) : tx.status === "processing" ? (
                            <Clock className="size-3" />
                          ) : (
                            <XCircle className="size-3" />
                          )}
                          {tx.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString()} •{" "}
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {tx.reference}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Modals for Quick Action card clicks or mobile triggers */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
      />

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availableBalanceEtb={availableEtb}
      />
    </div>
  );
}
