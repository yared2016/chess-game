"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Building2,
  UploadCloud,
  FileImage,
  Zap,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BENEFICIARY_NAME = "Abay Chess / Yared Tekleye";
const TELEBIRR_NUMBER =
  process.env.NEXT_PUBLIC_TELEBIRR_ACCOUNT ||
  process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_ID ||
  "0987678228";
const CBE_ACCOUNT =
  process.env.NEXT_PUBLIC_CBE_ACCOUNT || "1000456789123";
const CBE_BIRR_NUMBER =
  process.env.NEXT_PUBLIC_CBE_BIRR_ACCOUNT || "0987678228";

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

type PaymentChannel = "telebirr" | "cbe_bank" | "cbe_birr";
type VerificationMode = "instant" | "manual";

function cleanErrorMessage(err: unknown): string {
  if (!err) return "Verification connection error. Please try again.";
  let msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("duplicate-reference")) {
    return "This transaction reference has already been submitted or credited. Each transfer can only be credited once.";
  }
  if (msg.includes("Uncaught Error: ")) {
    msg = msg.split("Uncaught Error: ")[1] || msg;
  } else if (msg.includes("Server Error")) {
    msg = msg.split("Server Error")[1]?.replace(/^[:\s]+/, "") || msg;
  }
  msg = msg
    .replace(/\s*at\s+handler\s+.*$/i, "")
    .replace(/\s*Called by client.*$/i, "")
    .trim();
  return msg || "Verification connection error. Please try again.";
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");

  // Mode: Instant (Verify.et) vs Manual (receipt upload)
  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>("instant");

  // Manual flow steps
  const [step, setStep] = useState<"amount" | "transfer" | "status">("amount");

  // Payment configuration
  const [amountEtb, setAmountEtb] = useState<number>(1000);
  const [customInput, setCustomInput] = useState<string>("1000");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>("telebirr");
  const [depositCode, setDepositCode] = useState<string>("");

  // Sender details — derived avoiding effect-based setState
  const [customFullName, setCustomFullName] = useState<string | null>(null);
  const [customSenderAccount, setCustomSenderAccount] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>("");

  const defaultFullName =
    me?.fullName ||
    me?.accountHolderName ||
    me?.displayName ||
    me?.username ||
    "";

  const defaultSenderAccount =
    paymentMethod === "telebirr"
      ? (me?.telebirrNumber || me?.phoneNumber || "")
      : paymentMethod === "cbe_bank"
        ? (me?.bankAccountNumber || "")
        : (me?.phoneNumber || me?.telebirrNumber || "");

  const fullName = customFullName !== null ? customFullName : defaultFullName;
  const senderAccount =
    customSenderAccount !== null ? customSenderAccount : defaultSenderAccount;

  // Manual receipt screenshot
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Instant Verify.et state
  const [instantStatus, setInstantStatus] = useState<
    "idle" | "verifying" | "delayed" | "success" | "error"
  >("idle");
  const [instantErrorMessage, setInstantErrorMessage] = useState<string>("");
  const [instantSuccessData, setInstantSuccessData] = useState<{
    amount: number;
    depositId: string;
    reference: string;
  } | null>(null);

  const createDeposit = useMutation(api.deposits.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const handleSelectPreset = (val: number) => {
    setAmountEtb(val);
    setCustomInput(String(val));
  };

  const handleCustomChange = (val: string) => {
    setCustomInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmountEtb(parsed);
    } else {
      setAmountEtb(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      if (!selected.type.startsWith("image/")) {
        toast.error("Please upload an image receipt (PNG, JPG, JPEG, WEBP)");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("Receipt image must be under 10MB");
        return;
      }
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const channelLabel =
    paymentMethod === "telebirr"
      ? "Telebirr"
      : paymentMethod === "cbe_bank"
        ? "CBE Bank Account"
        : "CBE Birr";

  const recipientAccount =
    paymentMethod === "telebirr"
      ? TELEBIRR_NUMBER
      : paymentMethod === "cbe_bank"
        ? CBE_ACCOUNT
        : CBE_BIRR_NUMBER;

  // ---------------------------------------------------------------------------
  // INSTANT VERIFICATION (Verify.et)
  // ---------------------------------------------------------------------------
  const handleInstantVerify = async () => {
    if (amountEtb < 50) {
      toast.error("Minimum deposit is 50 ETB");
      return;
    }
    const cleanRef = transactionRef.trim();
    if (!cleanRef || cleanRef.length < 4) {
      toast.error("Please enter a valid Transaction / Reference ID.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Please enter your name as it appears on your bank account.");
      return;
    }
    if (!senderAccount.trim()) {
      toast.error(
        paymentMethod === "cbe_bank"
          ? "Please enter your sender CBE account or phone number."
          : "Please enter your sender mobile phone number."
      );
      return;
    }

    try {
      setInstantStatus("verifying");
      setInstantErrorMessage("");

      const formattedSenderInfo = `Method: ${channelLabel} | Name: ${fullName.trim()} | Account/Phone: ${senderAccount.trim()}`;

      // 1. Create deposit in Convex with verificationMethod: "verify_et"
      const res = await createDeposit({
        amount: amountEtb,
        paymentMethod,
        transactionReference: cleanRef,
        senderInfo: formattedSenderInfo,
        verificationMethod: "verify_et",
      });

      if (!res?.depositId) {
        throw new Error("Could not initialize deposit record");
      }

      setDepositCode(res.code || `ABAY-${Math.floor(100000 + Math.random() * 900000)}`);

      // 2. Call server-side verification endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        // After 10s if not resolved, allow player to fallback
        setInstantStatus("delayed");
      }, 10000);

      const response = await fetch("/api/finance/deposit/verify-et", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositId: res.depositId,
          paymentMethod,
          transactionReference: cleanRef,
          amount: amountEtb,
          senderName: fullName.trim(),
          senderPhone: senderAccount.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await response.json();

      if (response.ok && json.verified && json.status === "completed") {
        setInstantSuccessData({
          amount: json.amount || amountEtb,
          depositId: res.depositId,
          reference: cleanRef,
        });
        setInstantStatus("success");
        toast.success(`Payment verified! ${amountEtb} ETB credited to wallet.`);
      } else if (json.status === "pending" || json.status === "processing") {
        setInstantStatus("delayed");
      } else {
        setInstantStatus("error");
        setInstantErrorMessage(
          json.error ||
            "Unable to verify transaction reference. Please ensure the payment has completed."
        );
      }
    } catch (err: unknown) {
      setInstantStatus("error");
      const msg = cleanErrorMessage(err);
      setInstantErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Switch to manual review mode with fields already populated
  const handleFallbackToManual = () => {
    setVerificationMode("manual");
    setStep("transfer");
    if (!depositCode) {
      setDepositCode(`ABAY-${Math.floor(100000 + Math.random() * 900000)}`);
    }
  };

  // ---------------------------------------------------------------------------
  // MANUAL REVIEW SUBMISSION (Screenshot Upload)
  // ---------------------------------------------------------------------------
  const handleProceedToManualTransfer = () => {
    if (amountEtb < 50) {
      toast.error("Minimum deposit is 50 ETB");
      return;
    }
    const randPart = Math.floor(100000 + Math.random() * 900000);
    setDepositCode(`ABAY-${randPart}`);
    setStep("transfer");
  };

  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const isValidFullName = nameParts.length >= 2;
  const canSubmitManual = Boolean(file) && isValidFullName && !isSubmitting;

  const handleSubmitManualDeposit = async () => {
    if (!file) {
      toast.error("Transfer receipt screenshot is strictly required for manual review.");
      return;
    }

    if (!isValidFullName) {
      toast.error("Please provide your full name (at least First and Father name).");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Upload screenshot to Convex storage
      const postUrl = await generateUploadUrl();
      const uploadRes = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Receipt upload failed");
      const json = await uploadRes.json();
      const storageId = json.storageId;

      const formattedSenderInfo = `Method: ${channelLabel} | Name: ${fullName.trim()} | Account/Phone: ${senderAccount.trim()}`;

      // 2. Create deposit in Convex with verificationMethod: "manual"
      const res = await createDeposit({
        amount: amountEtb,
        paymentMethod,
        transactionReference: transactionRef.trim() || undefined,
        senderInfo: formattedSenderInfo,
        screenshotId: storageId,
        verificationMethod: "manual",
      });

      if (res?.code) {
        setDepositCode(res.code);
      }
      setStep("status");
      toast.success("Deposit receipt submitted for review!");
    } catch (error: unknown) {
      toast.error(cleanErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("amount");
    setInstantStatus("idle");
    setInstantErrorMessage("");
    setInstantSuccessData(null);
    setFile(null);
    setPreviewUrl(null);
    setTransactionRef("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden my-auto transition-all animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="border-b border-border/60 px-5 pt-4 pb-3 shrink-0 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shadow-xs">
                <CreditCard className="size-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Deposit Funds</span>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Telebirr, CBE Bank Account &amp; CBE Birr
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Mode Tabs: Instant Auto-Verify vs Manual Review */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60">
            <button
              type="button"
              onClick={() => {
                setVerificationMode("instant");
                if (instantStatus === "success") {
                  handleReset();
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                verificationMode === "instant"
                  ? "bg-card text-emerald-500 shadow-sm border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="size-3.5 fill-current text-emerald-500" />
              <span>Instant Auto-Verify</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 font-mono">
                Fast
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationMode("manual")}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                verificationMode === "manual"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UploadCloud className="size-3.5" />
              <span>Manual Review</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
                Fallback
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* ================================================================= */}
          {/* INSTANT AUTO-VERIFICATION MODE */}
          {/* ================================================================= */}
          {verificationMode === "instant" && (
            <>
              {instantStatus === "idle" && (
                <div className="space-y-4">
                  {/* Channel Selection */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      1. Select Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("telebirr")}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "telebirr"
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Smartphone className="size-5 text-emerald-500" />
                        <span className="text-xs font-bold text-foreground">Telebirr</span>
                        <span className="text-[10px] text-muted-foreground">App / USSD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cbe_bank")}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "cbe_bank"
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Building2 className="size-5 text-primary" />
                        <span className="text-xs font-bold text-foreground">CBE Bank</span>
                        <span className="text-[10px] text-muted-foreground">CBE Birr/App</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cbe_birr")}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "cbe_birr"
                            ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Smartphone className="size-5 text-amber-500" />
                        <span className="text-xs font-bold text-foreground">CBE Birr</span>
                        <span className="text-[10px] text-muted-foreground">Mobile wallet</span>
                      </button>
                    </div>
                  </div>

                  {/* Recipient Details Card */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Sparkles className="size-3" />
                        Transfer Recipient Details
                      </span>
                      <span className="text-xs font-extrabold text-foreground font-mono">
                        {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-card/90 p-2.5 rounded-xl border border-border/60">
                        <div className="text-[10px] text-muted-foreground">Recipient Name</div>
                        <div className="font-bold text-foreground truncate">{BENEFICIARY_NAME}</div>
                      </div>

                      <div className="flex items-center justify-between bg-card/90 p-2.5 rounded-xl border border-border/60">
                        <div className="min-w-0">
                          <div className="text-[10px] text-muted-foreground">
                            {channelLabel} Number / Account
                          </div>
                          <div className="font-mono font-bold text-foreground truncate">
                            {recipientAccount}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(recipientAccount, "acc_instant", "Account")}
                          className="h-7 px-2 text-[11px] gap-1 cursor-pointer shrink-0 ml-1.5"
                        >
                          {copiedKey === "acc_instant" ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          <span>{copiedKey === "acc_instant" ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        2. Deposit Amount (ETB)
                      </label>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Min: 50 ETB
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        max="100000"
                        value={customInput}
                        onChange={(e) => handleCustomChange(e.target.value)}
                        placeholder="1,000"
                        className="w-full h-11 px-4 pr-16 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      />
                      <span className="absolute right-4 top-3 text-xs font-mono font-bold text-muted-foreground">
                        ETB
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ Enter the exact deposit amount <strong>without</strong> telecom or bank fees (e.g. enter 1,000 ETB, not 1,005 ETB).
                    </p>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            amountEtb === preset
                              ? "bg-emerald-600 text-white font-bold shadow-xs"
                              : "bg-muted/50 text-foreground hover:bg-muted border border-border/60"
                          }`}
                        >
                          +{preset} ETB
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detected Legal Name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        3. Your Full Name (on Sender Account) *
                      </label>
                      {me && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Auto-detected
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setCustomFullName(e.target.value);
                      }}
                      placeholder="e.g. Abebe Bikila Kebede"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Make sure this matches the registered name on your banking or mobile wallet app.
                    </p>
                  </div>

                  {/* Sender Phone / Account Number */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        4. {paymentMethod === "cbe_bank" ? "Sender CBE Account / Phone *" : "Sender Phone Number *"}
                      </label>
                      {senderAccount && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Auto-detected
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={senderAccount}
                      onChange={(e) => setCustomSenderAccount(e.target.value)}
                      placeholder={
                        paymentMethod === "cbe_bank"
                          ? "e.g. 1000123456789 or 0911223344"
                          : "e.g. 0911223344 or 0711223344"
                      }
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {paymentMethod === "cbe_bank"
                        ? "Account or phone number used to make the bank transfer."
                        : "The mobile phone number registered on your sending wallet account."}
                    </p>
                  </div>

                  {/* Transaction ID / Reference */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      5. Transaction ID / Reference Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder={
                        paymentMethod === "telebirr"
                          ? "e.g. TF2408129841 or 10-digit Telebirr Txn ID"
                          : "e.g. FT2408129841 or Bank confirmation reference"
                      }
                      className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Enter the exact reference code from your SMS confirmation or transfer receipt.
                    </p>
                  </div>

                  {/* Fee Summary */}
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Requested deposit</span>
                      <span className="font-mono font-semibold text-foreground">
                        {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Abay Chess platform fee</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        0.00 ETB (Free)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between font-bold">
                      <span className="text-foreground">Instant Wallet Credit</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Verifying Spinner Screen */}
              {instantStatus === "verifying" && (
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center animate-in fade-in">
                  <div className="relative">
                    <div className="size-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    <Zap className="size-6 text-emerald-500 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      Verifying with Bank Records...
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Checking transaction reference{" "}
                      <strong className="font-mono text-foreground">{transactionRef}</strong> for{" "}
                      <strong className="text-foreground">{amountEtb.toFixed(2)} ETB</strong>.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
                    <Clock className="size-3.5 text-emerald-500 animate-pulse" />
                    <span>Instant automated verification usually completes in 3–8 seconds</span>
                  </div>
                </div>
              )}

              {/* Delayed / Fallback Screen */}
              {instantStatus === "delayed" && (
                <div className="space-y-4 py-4 text-center animate-in fade-in">
                  <div className="rounded-full bg-amber-500/10 p-3 text-amber-500 ring-8 ring-amber-500/5 mx-auto size-fit">
                    <Clock className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      Network Verification in Progress
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      The bank network is taking a moment to reflect your transaction reference. Your
                      deposit record has been safely created.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID:</span>
                      <span className="font-mono font-bold text-foreground">{transactionRef}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-bold text-foreground">{amountEtb.toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-semibold text-amber-500">Checking Bank Network</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground text-left">
                    <p className="font-semibold text-foreground mb-1">Options:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>You can retry the instant verification check.</li>
                      <li>
                        Or attach your receipt screenshot for prioritized manual review by our team.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Error Screen */}
              {instantStatus === "error" && (
                <div className="space-y-4 py-4 text-center animate-in fade-in">
                  <div className="rounded-full bg-rose-500/10 p-3 text-rose-500 ring-8 ring-rose-500/5 mx-auto size-fit">
                    <AlertCircle className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      Verification Not Completed
                    </h3>
                    <p className="text-xs text-rose-400 max-w-sm mx-auto leading-relaxed">
                      {instantErrorMessage ||
                        "We couldn't verify this transaction reference with the banking network."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-3 text-left text-[11px] text-muted-foreground space-y-1.5">
                    <p className="font-semibold text-foreground">Quick Troubleshooting:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Check that your Transaction ID is typed exactly as in your SMS.</li>
                      <li>Allow 1–2 minutes after completing the transfer before verifying.</li>
                      <li>Make sure the entered amount matches the net amount transferred without extra provider fees (e.g. {amountEtb} ETB, not {amountEtb + 5} ETB).</li>
                      <li>Ensure the transfer was sent to the official Abay Chess recipient ({paymentMethod === "cbe_bank" ? CBE_ACCOUNT : TELEBIRR_NUMBER} / Yared Tekleye).</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Success Screen */}
              {instantStatus === "success" && (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center animate-in zoom-in-95 duration-200">
                  <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500 ring-8 ring-emerald-500/5">
                    <CheckCircle2 className="size-12" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Deposit Verified &amp; Credited! 🎉
                  </h3>
                  <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
                    Your deposit of{" "}
                    <strong className="text-foreground text-sm">
                      {instantSuccessData?.amount.toFixed(2)} ETB
                    </strong>{" "}
                    via <strong className="text-foreground">{channelLabel}</strong> has been
                    instantly verified and credited to your wallet balance.
                  </p>

                  <div className="w-full max-w-sm rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-muted-foreground text-left space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span>Transaction Ref:</span>
                      <span className="font-bold text-foreground">
                        {instantSuccessData?.reference}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Verification Method:</span>
                      <span className="font-bold text-emerald-500">Automated</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wallet Credit:</span>
                      <span className="font-bold text-emerald-400">
                        +{instantSuccessData?.amount.toFixed(2)} ETB
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================= */}
          {/* MANUAL RECEIPT UPLOAD MODE */}
          {/* ================================================================= */}
          {verificationMode === "manual" && (
            <>
              {step === "amount" && (
                <div className="space-y-4">
                  {/* Payment Channel Selection */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      1. Select Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("telebirr")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "telebirr"
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Smartphone className="size-5 text-emerald-500" />
                        <span className="text-xs font-bold text-foreground">Telebirr</span>
                        <span className="text-[10px] text-muted-foreground">Direct app</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cbe_bank")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "cbe_bank"
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Building2 className="size-5 text-primary" />
                        <span className="text-xs font-bold text-foreground">CBE Bank</span>
                        <span className="text-[10px] text-muted-foreground">Bank account</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cbe_birr")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                          paymentMethod === "cbe_birr"
                            ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30"
                            : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Smartphone className="size-5 text-amber-500" />
                        <span className="text-xs font-bold text-foreground">CBE Birr</span>
                        <span className="text-[10px] text-muted-foreground">Mobile wallet</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        2. Deposit Amount (ETB)
                      </label>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Min: 50 ETB
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        max="100000"
                        value={customInput}
                        onChange={(e) => handleCustomChange(e.target.value)}
                        placeholder="1,000"
                        className="w-full h-12 px-4 pr-16 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-muted-foreground">
                        ETB
                      </span>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            amountEtb === preset
                              ? "bg-primary text-primary-foreground shadow-xs font-bold"
                              : "bg-muted/50 text-foreground hover:bg-muted border border-border/60"
                          }`}
                        >
                          +{preset} ETB
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fee Summary */}
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Requested deposit</span>
                      <span className="font-mono font-semibold text-foreground">
                        {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Abay Chess platform fee</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        0.00 ETB (Free)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold">
                      <span className="text-foreground">Wallet Credit Upon Approval</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === "transfer" && (
                <div className="space-y-4">
                  {/* Beneficiary Details */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Recipient Payment Details
                      </span>
                      <span className="text-xs font-extrabold text-foreground font-mono">
                        {amountEtb.toFixed(2)} ETB
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-card/80 p-2.5 rounded-xl border border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Payment Channel</div>
                          <div className="font-bold text-foreground">{channelLabel}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-card/80 p-2.5 rounded-xl border border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Account Holder</div>
                          <div className="font-bold text-foreground">{BENEFICIARY_NAME}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-card/80 p-2.5 rounded-xl border border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Account / Number</div>
                          <div className="font-mono font-bold text-foreground text-sm">
                            {recipientAccount}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(recipientAccount, "acc", "Account number")}
                          className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
                        >
                          {copiedKey === "acc" ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between bg-card/80 p-2.5 rounded-xl border border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground">
                            Unique Deposit Reference
                          </div>
                          <div className="font-mono font-bold text-foreground text-sm">
                            {depositCode}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(depositCode, "code", "Reference code")}
                          className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
                        >
                          {copiedKey === "code" ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Sender Details Form */}
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Your Full Name (on Sender Account) *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setCustomFullName(e.target.value)}
                        placeholder="e.g. Abebe Bikila Kebede"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Sender Phone / Account
                        </label>
                        <input
                          type="text"
                          value={senderAccount}
                          onChange={(e) => setCustomSenderAccount(e.target.value)}
                          placeholder="e.g. 0912345678"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Transaction / Ref Number
                        </label>
                        <input
                          type="text"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="e.g. TF2408129841"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Screenshot Upload */}
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Upload Transfer Receipt Screenshot *
                      </label>
                      {!file ? (
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group">
                          <UploadCloud className="size-7 text-muted-foreground group-hover:text-primary transition-colors mb-1.5" />
                          <span className="text-xs font-semibold text-foreground">
                            Click or drag receipt screenshot here
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            PNG, JPG, JPEG, WEBP up to 10MB
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-muted/30">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {previewUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={previewUrl}
                                alt="Receipt Preview"
                                className="size-11 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <FileImage className="size-8 text-primary" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {(file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleClearFile}
                            className="text-muted-foreground hover:text-rose-500 h-8 px-2 cursor-pointer"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === "status" && (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500 ring-8 ring-emerald-500/5">
                    <CheckCircle2 className="size-10" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Deposit Submitted for Review
                  </h3>
                  <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
                    We received your deposit request of{" "}
                    <strong className="text-foreground">{amountEtb.toFixed(2)} ETB</strong> via{" "}
                    <strong className="text-foreground">{channelLabel}</strong> with reference code{" "}
                    <strong className="font-mono text-foreground font-bold">{depositCode}</strong>.
                  </p>
                  <div className="w-full max-w-sm rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground text-left space-y-1">
                    <div className="flex justify-between">
                      <span>Sender Name:</span>
                      <span className="font-semibold text-foreground">{fullName}</span>
                    </div>
                    {senderAccount && (
                      <div className="flex justify-between">
                        <span>Sender Account:</span>
                        <span className="font-semibold text-foreground">{senderAccount}</span>
                      </div>
                    )}
                    {transactionRef && (
                      <div className="flex justify-between">
                        <span>Transaction Ref:</span>
                        <span className="font-semibold text-foreground">{transactionRef}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-amber-500">Pending Review</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your wallet balance will be credited as soon as an administrator verifies the
                    transfer.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 shrink-0 space-y-2.5">
          {/* Instant Mode Footers */}
          {verificationMode === "instant" && (
            <>
              {instantStatus === "idle" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleInstantVerify}
                    disabled={amountEtb < 50 || !transactionRef.trim() || !fullName.trim()}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Zap className="size-4 fill-current" />
                    <span>Verify &amp; Credit Instantly</span>
                  </Button>
                </div>
              )}

              {instantStatus === "verifying" && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFallbackToManual}
                    className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Switch to Manual Receipt Upload
                  </Button>
                </div>
              )}

              {instantStatus === "delayed" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleInstantVerify}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Retry Check</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFallbackToManual}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UploadCloud className="size-4" />
                    <span>Attach Receipt for Review</span>
                  </Button>
                </div>
              )}

              {instantStatus === "error" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInstantStatus("idle")}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Edit Reference ID
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFallbackToManual}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UploadCloud className="size-4" />
                    <span>Submit Receipt Instead</span>
                  </Button>
                </div>
              )}

              {instantStatus === "success" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Make Another Deposit
                  </Button>
                  <Button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    Done / View Wallet
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Manual Mode Footers */}
          {verificationMode === "manual" && (
            <>
              {step === "amount" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleProceedToManualTransfer}
                    disabled={amountEtb < 50}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span>Continue to Transfer</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              )}

              {step === "transfer" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("amount")}
                    disabled={isSubmitting}
                    className="h-11 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitManualDeposit}
                    disabled={!canSubmitManual}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Submitting Receipt...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit for Review</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {step === "status" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep("amount");
                      setFile(null);
                      setPreviewUrl(null);
                      setAmountEtb(1000);
                      setCustomInput("1000");
                      setTransactionRef("");
                    }}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Make Another Deposit
                  </Button>
                  <Button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Abay Chess Verified Payment Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
