"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
  Info,
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

const PRESET_AMOUNTS = [100, 500, 1000, 2500, 5000];

type PaymentChannel = "telebirr" | "cbe_bank" | "cbe_birr";

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [step, setStep] = useState<"amount" | "transfer" | "status">("amount");
  const [amountEtb, setAmountEtb] = useState<number>(1000);
  const [customInput, setCustomInput] = useState<string>("1000");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>("telebirr");
  const [depositCode, setDepositCode] = useState<string>("");

  // Sender details
  const [fullName, setFullName] = useState<string>("");
  const [senderAccount, setSenderAccount] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");

  // Receipt image
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleProceedToTransfer = () => {
    if (amountEtb < 50) {
      toast.error("Minimum deposit is 50 ETB");
      return;
    }
    const randPart = Math.floor(100000 + Math.random() * 900000);
    setDepositCode(`ABAY-${randPart}`);
    setStep("transfer");
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

  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const isValidFullName = nameParts.length >= 2;
  const canSubmit = Boolean(file) && isValidFullName && !isSubmitting;

  const handleSubmitDeposit = async () => {
    if (!file) {
      toast.error("Transfer receipt screenshot is strictly required to deposit.");
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

      const channelLabel =
        paymentMethod === "telebirr"
          ? "Telebirr"
          : paymentMethod === "cbe_bank"
            ? "CBE Bank Account"
            : "CBE Birr";

      const formattedSenderInfo = `Method: ${channelLabel} | Name: ${fullName.trim()} | Account/Phone: ${senderAccount.trim()}`;

      // 2. Create deposit in Convex
      const res = await createDeposit({
        amount: amountEtb,
        paymentMethod,
        transactionReference: transactionRef.trim() || undefined,
        senderInfo: formattedSenderInfo,
        screenshotId: storageId,
      });

      if (res?.code) {
        setDepositCode(res.code);
      }
      setStep("status");
      toast.success("Deposit receipt submitted for verification!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit deposit");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto transition-all animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shadow-xs">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Deposit Funds
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Manual receipt verification via Telebirr, CBE Bank &amp; CBE Birr
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

        {/* Modal Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
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

                {/* Preset Amount Chips */}
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

              {/* Transparent Fee & Wallet Credit Summary */}
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

              <div className="rounded-2xl bg-muted/40 border border-border/60 p-3 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  You must transfer the exact requested amount. Any transfer fee independently charged by Telebirr or CBE is governed by that provider.
                </span>
              </div>
            </div>
          )}

          {step === "transfer" && (
            <div className="space-y-4">
              {/* Beneficiary Details Card */}
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
                      <div className="text-[10px] text-muted-foreground">Unique Deposit Reference</div>
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

              {/* Sender & Receipt Submission Form */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Your Full Name (on Sender Account) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
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
                      onChange={(e) => setSenderAccount(e.target.value)}
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

                {/* Receipt Screenshot Upload */}
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
                Your wallet balance will be credited as soon as an administrator verifies the transfer.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 shrink-0 space-y-2.5">
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
                onClick={handleProceedToTransfer}
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
                onClick={handleSubmitDeposit}
                disabled={!canSubmit}
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
                  setFullName("");
                  setSenderAccount("");
                  setTransactionRef("");
                  setAmountEtb(1000);
                  setCustomInput("1000");
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

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Abay Chess Verified Payment Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
