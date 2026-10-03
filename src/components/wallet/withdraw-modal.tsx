"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  Loader2,
  ShieldCheck,
  User,
  Hash,
  X,
  Phone,
  Building2,
  Smartphone,
  ArrowRight,
  Wallet,
  AlertCircle,
  Search,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  calculateWithdrawalFee,
  formatEtb,
  toSantims,
  getChapaFeeRatePercent,
} from "@/lib/payments/money";
import type { BankInfo } from "@/lib/payments/types";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceEtb: number;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000];

const POPULAR_ETHIOPIAN_BANKS = [
  { matchKey: "commercial", shortLabel: "CBE", name: "Commercial Bank of Ethiopia" },
  { matchKey: "abyssinia", shortLabel: "Abyssinia", name: "Bank of Abyssinia" },
  { matchKey: "awash", shortLabel: "Awash", name: "Awash Bank" },
  { matchKey: "dashen", shortLabel: "Dashen", name: "Dashen Bank" },
  { matchKey: "coop", shortLabel: "Coop", name: "Cooperative Bank of Oromia" },
  { matchKey: "hibret", shortLabel: "Hibret", name: "Hibret Bank" },
  { matchKey: "zemen", shortLabel: "Zemen", name: "Zemen Bank" },
  { matchKey: "nib", shortLabel: "Nib", name: "Nib International Bank" },
];

function getBankInitials(name?: string): string {
  if (!name) return "BNK";
  // If name contains parentheses with abbreviation like (CBE), (COOP), extract it
  const match = name.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].slice(0, 4).toUpperCase();
  }
  // Otherwise take first letter of each word up to 3 chars
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalanceEtb,
}: WithdrawModalProps) {
  const [method, setMethod] = useState<"telebirr" | "bank">("telebirr");
  const [amountEtb, setAmountEtb] = useState<number>(500);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("855"); // default Telebirr
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountHolderName, setAccountHolderName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);

  // Interactive Bank Picker State
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let isSubscribed = true;
    fetch("/api/finance/banks")
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        if (data.banks && Array.isArray(data.banks)) {
          setBanks(data.banks);
          // Set first non-telebirr bank as default bank when banks load
          const firstNonTele = data.banks.find((b: BankInfo) => b.code !== "855");
          if (firstNonTele && selectedBank === "855") {
            setSelectedBank(firstNonTele.code);
          }
        }
        if (typeof data.isTestMode === "boolean") {
          setIsTestMode(data.isTestMode);
        }
      })
      .catch((err) => console.error("Failed to load banks:", err))
      .finally(() => {
        if (isSubscribed) setIsLoadingBanks(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  const nonTelebirrBanks = useMemo(() => {
    return banks.filter((b) => b.code !== "855");
  }, [banks]);

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return nonTelebirrBanks;
    const q = bankSearch.toLowerCase().trim();
    return nonTelebirrBanks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q)
    );
  }, [nonTelebirrBanks, bankSearch]);

  if (!isOpen) return null;

  const santims = toSantims(amountEtb > 0 ? amountEtb : 0);
  const feeCalc = calculateWithdrawalFee(santims > 0 ? santims : 50000);
  const totalRequiredEtb = feeCalc.totalDeductionSantims / 100;
  const hasSufficientFunds = availableBalanceEtb >= totalRequiredEtb;
  const feePercent = getChapaFeeRatePercent();
  const remainingBalanceEtb = Math.max(0, availableBalanceEtb - totalRequiredEtb);

  const effectiveBankCode = method === "telebirr" ? "855" : selectedBank;
  const selectedBankObj = banks.find((b) => b.code === effectiveBankCode);

  function handleQuickAmount(val: number) {
    if (val === -1) {
      const maxPossibleReceive = Math.floor(availableBalanceEtb / (1 + feePercent / 100));
      setAmountEtb(Math.max(50, maxPossibleReceive));
    } else {
      setAmountEtb(val);
    }
  }

  async function handleWithdraw() {
    if (amountEtb < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (!hasSufficientFunds) {
      toast.error(`Insufficient balance. You need ${totalRequiredEtb.toFixed(2)} ETB including fee.`);
      return;
    }
    if (!accountNumber.trim() || !accountHolderName.trim()) {
      toast.error("Please fill out all recipient account fields");
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/\s/g, "");

    if (method === "telebirr") {
      if (!/^(09|07|\+2519|\+2517)\d{8}$/.test(cleanAcc) && cleanAcc.length !== 10) {
        toast.error("Telebirr phone number must be 10 digits (e.g. 0912345678 or 0712345678)");
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
      method === "telebirr" ? "telebirr" : (selectedBankObj ? selectedBankObj.name : "Bank Transfer");

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountEtb,
          bankName,
          bankCode: effectiveBankCode,
          accountNumber: cleanAcc,
          accountHolderName: accountHolderName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Withdrawal request failed");
      }

      if (data.status === "completed") {
        toast.success("Payout completed! Funds successfully sent.");
        onClose();
        return;
      }

      if (data.internalTransferRef) {
        toast.info("Transfer registered with Chapa. Confirming status...");
        let settled = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const vRes = await fetch("/api/finance/withdrawal/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ internalTransferRef: data.internalTransferRef }),
            });
            const vData = await vRes.json();
            if (vData.status === "completed") {
              toast.success("Withdrawal completed! Funds successfully transferred.");
              settled = true;
              break;
            } else if (vData.status === "failed") {
              toast.error(`Transfer rejected: ${vData.error || "Provider error"}. Funds restored to wallet.`);
              settled = true;
              break;
            }
          } catch {
            // retry
          }
        }
        if (!settled) {
          toast.success("Withdrawal queued. Funds remain reserved and will finalize automatically.");
        }
      } else {
        toast.success("Withdrawal initiated! Transfer queued with Chapa.");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to process withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden my-auto transition-all animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Withdraw Funds
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Available to withdraw:</span>
                <span className="font-mono font-semibold text-foreground">
                  {availableBalanceEtb.toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 pb-28 space-y-4 text-xs overscroll-contain">
          {/* Test Mode Banner */}
          {isTestMode && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
              <span className="text-base shrink-0">🧪</span>
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-bold block">Sandbox Test Mode Active</span>
                <span>
                  Transfers are simulated without real money movement. Use account ending in{" "}
                  <strong className="font-mono font-semibold">2233</strong> to simulate rejection.
                </span>
              </div>
            </div>
          )}

          {/* Method Toggle: Telebirr vs Bank */}
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block">
              Payout Destination
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/70">
              <button
                type="button"
                onClick={() => setMethod("telebirr")}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl font-semibold transition-all text-xs ${
                  method === "telebirr"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Smartphone className="size-4 shrink-0" />
                <span>Telebirr</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod("bank");
                  if (nonTelebirrBanks.length > 0 && selectedBank === "855") {
                    setSelectedBank(nonTelebirrBanks[0].code);
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl font-semibold transition-all text-xs ${
                  method === "bank"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Building2 className="size-4 shrink-0" />
                <span>Bank Account</span>
              </button>
            </div>
          </div>

          {/* Amount to Receive + Quick Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                Amount to receive (ETB)
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                Min: 50 ETB
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="50"
                step="1"
                value={amountEtb || ""}
                onChange={(e) => setAmountEtb(parseFloat(e.target.value) || 0)}
                placeholder="500"
                className="w-full h-12 px-4 pr-16 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-muted-foreground">
                ETB
              </span>
            </div>

            {/* Quick Preset Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmount(amt)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                    amountEtb === amt
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted/50 text-foreground hover:bg-muted border border-border/60"
                  }`}
                >
                  {amt} ETB
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleQuickAmount(-1)}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all ml-auto"
              >
                Max Balance
              </button>
            </div>
          </div>

          {/* Destination Details Card */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-3.5 shadow-2xs">
            {method === "bank" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block">
                    Destination Bank
                  </label>
                  {selectedBankObj?.acctLength ? (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      {selectedBankObj.acctLength} digits required
                    </span>
                  ) : null}
                </div>
                {isLoadingBanks ? (
                  <div className="flex items-center gap-2 h-12 px-3.5 rounded-2xl border border-border/80 bg-muted/20 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Loading supported banks...</span>
                  </div>
                ) : (
                  /* Custom Interactive Bank Trigger Button */
                  <button
                    type="button"
                    onClick={() => setIsBankPickerOpen(true)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-background hover:bg-muted/40 text-foreground transition-all shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-bold text-xs uppercase border border-primary/25 shrink-0 group-hover:bg-primary/20 transition-colors">
                        {getBankInitials(selectedBankObj?.name)}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {selectedBankObj?.name || "Select Destination Bank"}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>
                            {selectedBankObj?.acctLength
                              ? `${selectedBankObj.acctLength}-digit account`
                              : "Standard Bank Account"}
                          </span>
                          <span>&bull;</span>
                          <span className="text-primary font-semibold group-hover:underline">Change Bank</span>
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block mb-1.5">
                {method === "telebirr" ? "Telebirr Phone Number" : "Bank Account Number"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={
                    method === "telebirr"
                      ? "e.g. 0912345678 (10 digits)"
                      : selectedBankObj?.acctLength
                        ? `Enter ${selectedBankObj.acctLength}-digit account number`
                        : "Enter account number"
                  }
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full h-12 pl-10 pr-3.5 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all scroll-m-12"
                />
                {method === "telebirr" ? (
                  <Phone className="size-4 text-muted-foreground absolute left-3.5 top-4" />
                ) : (
                  <Hash className="size-4 text-muted-foreground absolute left-3.5 top-4" />
                )}
              </div>
            </div>

            <div>
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block mb-1.5">
                Account Holder Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Full name matching your bank / Telebirr account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full h-12 pl-10 pr-3.5 rounded-2xl border border-border/80 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all scroll-m-12"
                />
                <User className="size-4 text-muted-foreground absolute left-3.5 top-4" />
              </div>
            </div>
          </div>

          {/* Fee & Deduction Breakdown Card */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Amount you receive</span>
              <span className="font-mono font-semibold text-foreground">
                {formatEtb(feeCalc.userReceivesSantims)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Chapa transfer fee ({feePercent}%)</span>
              <span className="font-mono font-semibold text-muted-foreground">
                {formatEtb(feeCalc.providerFeeSantims)}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold">
              <span className="text-foreground">Total deduction from wallet</span>
              <span
                className={`font-mono font-bold ${
                  hasSufficientFunds ? "text-primary" : "text-destructive"
                }`}
              >
                {formatEtb(feeCalc.totalDeductionSantims)}
              </span>
            </div>
            {hasSufficientFunds ? (
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Remaining available balance</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {remainingBalanceEtb.toFixed(2)} ETB
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-destructive font-semibold pt-1">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Insufficient balance for requested amount + transfer fee.</span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            INTERACTIVE CUSTOM BANK PICKER MODAL / SHEET
            (Positioned over the full dialog so it never overlaps or clips)
            ========================================================= */}
        {isBankPickerOpen && (
          <div className="absolute inset-0 z-50 bg-card p-4 sm:p-5 flex flex-col justify-between rounded-t-3xl sm:rounded-3xl animate-in fade-in zoom-in-95 duration-150">
            {/* Picker Header & Search */}
            <div className="space-y-3 pb-3 border-b border-border/60 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Select Destination Bank</h3>
                    <p className="text-[10px] text-muted-foreground">Supported Ethiopian Commercial &amp; Private Banks</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsBankPickerOpen(false);
                    setBankSearch("");
                  }}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close bank picker"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Instant Search Bar (no autofocus to avoid mobile virtual keyboard blocking view) */}
              <div className="relative">
                <Search className="size-3.5 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by bank name or code..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-8 rounded-xl border border-border/80 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
                {bankSearch && (
                  <button
                    type="button"
                    onClick={() => setBankSearch("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Popular Banks 1-Tap Quick Select */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Popular Banks (1-Tap Select)
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {POPULAR_ETHIOPIAN_BANKS.map((quick) => (
                    <button
                      key={quick.shortLabel}
                      type="button"
                      onClick={() => {
                        const found = nonTelebirrBanks.find((b) =>
                          b.name.toLowerCase().includes(quick.matchKey) ||
                          b.name.toLowerCase().includes(quick.shortLabel.toLowerCase())
                        );
                        if (found) {
                          setSelectedBank(found.code);
                          setIsBankPickerOpen(false);
                          setBankSearch("");
                        } else {
                          setBankSearch(quick.shortLabel);
                        }
                      }}
                      className="px-2 py-1.5 rounded-xl text-center text-[10px] font-bold bg-muted/60 hover:bg-primary/15 hover:text-primary hover:border-primary/40 border border-border/60 transition-all truncate cursor-pointer active:scale-95"
                    >
                      {quick.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Banks List */}
            <div className="flex-1 min-h-0 overflow-y-auto my-2 space-y-1.5 pr-1 overscroll-contain">
              {filteredBanks.length > 0 ? (
                filteredBanks.map((b) => {
                  const isSelected = selectedBank === b.code;
                  return (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => {
                        setSelectedBank(b.code);
                        setIsBankPickerOpen(false);
                        setBankSearch("");
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-2xl border text-left transition-all cursor-pointer group ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                          : "border-border/60 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex size-8.5 items-center justify-center rounded-xl text-[10px] font-black uppercase shrink-0 border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border/60"
                          }`}
                        >
                          {getBankInitials(b.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{b.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {b.acctLength ? `${b.acctLength} digits required` : "Standard bank account"}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 ml-2">
                          <Check className="size-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No banks found matching &ldquo;{bankSearch}&rdquo;.
                </div>
              )}
            </div>

            {/* Picker Footer */}
            <div className="pt-2 border-t border-border/50 shrink-0 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">
                {filteredBanks.length} {filteredBanks.length === 1 ? "bank" : "banks"} available
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsBankPickerOpen(false);
                  setBankSearch("");
                }}
                className="h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 shrink-0 space-y-2.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleWithdraw}
              disabled={isSubmitting || !hasSufficientFunds || amountEtb < 50}
              className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 gap-2 shadow-xs transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Request Payout</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Direct Payout to Telebirr &amp; Banks via Chapa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
