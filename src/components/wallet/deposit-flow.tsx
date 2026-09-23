"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileImage,
  Phone,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  User,
  X,
} from "lucide-react";

const BENEFICIARY_NAME = "Castle Chess / Yared Tekleye";
const TELEBIRR_NUMBER = process.env.NEXT_PUBLIC_TELEBIRR_ACCOUNT || process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_ID || "0987678228";
const CBE_ACCOUNT = process.env.NEXT_PUBLIC_CBE_ACCOUNT || "1000456789123";

export function DepositFlow() {
  const [step, setStep] = useState<"amount" | "payment" | "status">("amount");
  const [amountInput, setAmountInput] = useState<string>("100");
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [depositCode, setDepositCode] = useState<string>("");
  const [depositId, setDepositId] = useState<any>(null);

  // Payment details
  const [paymentMethod, setPaymentMethod] = useState<"telebirr" | "cbe">("telebirr");
  const [fullName, setFullName] = useState<string>("");
  const [senderPhone, setSenderPhone] = useState<string>("");

  // Receipt screenshot
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const createDeposit = useMutation(api.deposits?.create as any);
  const generateUploadUrl = useMutation(api.storage?.generateUploadUrl as any);
  const uploadScreenshot = useMutation(api.deposits?.uploadScreenshot as any);

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const handleSelectPreset = (val: number) => {
    setAmountInput(val.toString());
  };

  const handleProceedToPayment = async () => {
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt < 50) {
      toast.error("Minimum deposit is 50 ETB");
      return;
    }

    try {
      setIsCreating(true);
      const res = await createDeposit({ amount: amt });
      const code = res.code || `CAS-${Math.floor(1000 + Math.random() * 9000)}`;
      const depId = res.depositId || res.id || res._id;
      setDepositAmount(amt);
      setDepositCode(code);
      setDepositId(depId);
      setStep("payment");
    } catch (error: any) {
      toast.error(error.message || "Failed to initialize deposit");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      if (!selected.type.startsWith("image/")) {
        toast.error("Please upload an image receipt (PNG, JPG, JPEG)");
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

  // Validation
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const isValidFullName = nameParts.length >= 2;
  const isThreeNames = nameParts.length >= 3;
  const cleanedPhone = senderPhone.trim().replace(/\D/g, "");
  const isValidPhone = cleanedPhone.length >= 9;
  const canSubmit = Boolean(file) && isValidFullName && isValidPhone && !isUploading;

  const handleSubmitDeposit = async () => {
    if (!depositId) {
      toast.error("Deposit session expired. Please start over.");
      return;
    }

    if (!file) {
      toast.error("Transfer receipt screenshot is strictly required to deposit.");
      return;
    }

    if (!isValidFullName) {
      toast.error("Please provide your full 3 names (First, Father, Grandfather).");
      return;
    }

    if (!isValidPhone) {
      toast.error("Please enter a valid phone number (at least 9 digits).");
      return;
    }

    try {
      setIsUploading(true);

      // 1. Upload screenshot to Convex storage
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Screenshot upload failed");
      const json = await result.json();
      const storageId = json.storageId;

      const formattedSenderInfo = `Method: ${paymentMethod === "telebirr" ? "Telebirr" : "CBE Bank"} | Name: ${fullName.trim()} | Phone: ${senderPhone.trim()}`;

      // 2. Link storageId and formatted senderInfo to deposit record
      await uploadScreenshot({
        depositId,
        storageId,
        senderInfo: formattedSenderInfo,
      });

      setStep("status");
      toast.success("Deposit and screenshot submitted for admin review!");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit deposit");
    } finally {
      setIsUploading(false);
    }
  };

  if (step === "status") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500 ring-8 ring-emerald-500/5">
          <CheckCircle2 className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Deposit Submitted for Review</h3>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          We received your deposit request of <strong>{depositAmount} ETB</strong> via{" "}
          <strong>{paymentMethod === "telebirr" ? "Telebirr" : "CBE Bank"}</strong> with reference code{" "}
          <strong className="font-mono text-foreground font-bold">{depositCode}</strong>.
          Sender: <strong>{fullName}</strong> ({senderPhone}).
          Your wallet balance will be credited as soon as an admin verifies it (usually within 5–15 minutes).
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep("amount");
              setFile(null);
              setPreviewUrl(null);
              setFullName("");
              setSenderPhone("");
              setAmountInput("100");
            }}
          >
            Make Another Deposit
          </Button>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ArrowUpRight className="size-5 text-emerald-500" />
              Complete Your Deposit
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose payment channel, transfer funds, and upload the transfer receipt.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">Amount</span>
            <span className="text-lg font-extrabold text-emerald-500">{depositAmount} ETB</span>
          </div>
        </div>

        {/* Step-by-Step Payment Instructions */}
        <div className="space-y-4">
          {/* Channel Selector: Telebirr vs CBE Bank */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              1. Choose Payment Channel
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("telebirr")}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  paymentMethod === "telebirr"
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                    : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="rounded-lg p-2 bg-emerald-500/15 text-emerald-500 shrink-0">
                  <Smartphone className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-foreground truncate">Telebirr</div>
                  <div className="text-[11px] text-muted-foreground truncate">Direct App Transfer</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("cbe")}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  paymentMethod === "cbe"
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="rounded-lg p-2 bg-primary/15 text-primary shrink-0">
                  <Building2 className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-foreground truncate">CBE Bank</div>
                  <div className="text-[11px] text-muted-foreground truncate">Commercial Bank</div>
                </div>
              </button>
            </div>
          </div>

          {/* Account & Beneficiary Details */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-primary">
                <ShieldCheck className="size-4" />
                <span>2. Official Beneficiary Details</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Verified Account
              </span>
            </div>

            {/* Beneficiary Name */}
            <div className="flex items-center justify-between rounded-lg bg-background/90 border p-2.5">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Beneficiary Name</span>
                <span className="text-xs sm:text-sm font-bold text-foreground truncate block">
                  {BENEFICIARY_NAME}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7.5 px-2.5 gap-1.5 text-xs font-semibold shrink-0"
                onClick={() => handleCopy(BENEFICIARY_NAME, "beneficiary", "Beneficiary name")}
              >
                {copiedKey === "beneficiary" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copiedKey === "beneficiary" ? "Copied" : "Copy"}
              </Button>
            </div>

            {/* Account / Phone Number */}
            <div className="flex items-center justify-between rounded-lg bg-background/90 border p-2.5">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                  {paymentMethod === "telebirr" ? "Telebirr Account / Phone" : "CBE Account Number"}
                </span>
                <span className="text-sm sm:text-base font-black text-foreground font-mono truncate block">
                  {paymentMethod === "telebirr" ? TELEBIRR_NUMBER : CBE_ACCOUNT}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7.5 px-2.5 gap-1.5 text-xs font-semibold shrink-0"
                onClick={() =>
                  handleCopy(
                    paymentMethod === "telebirr" ? TELEBIRR_NUMBER : CBE_ACCOUNT,
                    "account",
                    paymentMethod === "telebirr" ? "Telebirr number" : "CBE account",
                  )
                }
              >
                {copiedKey === "account" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copiedKey === "account" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Reference Remark Code */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">
                3. Mandatory Transfer Remark / Reason
              </span>
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Required
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Put this reference code in the transaction remark or description so our system can automatically identify your deposit:
            </p>
            <div className="flex items-center justify-between rounded-lg bg-background border border-amber-500/30 p-2.5 sm:p-3">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-primary">
                {depositCode}
              </span>
              <Button
                size="sm"
                variant={copiedKey === "code" ? "default" : "outline"}
                className="h-8 sm:h-9 gap-1.5 text-xs font-bold shrink-0"
                onClick={() => handleCopy(depositCode, "code", "Deposit reference code")}
              >
                {copiedKey === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedKey === "code" ? "Copied" : "Copy Code"}
              </Button>
            </div>
          </div>

          {/* Mandatory Sender Full Name (3 Names) & Phone */}
          <div className="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              4. Your Account Verification Details (Strictly Required)
            </span>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Sender Full Name (First + Father + Grandfather)</span>
                <span className="text-[11px] font-bold text-destructive">* Required</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Abebe Kebede Tadesse"
                  className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {!isThreeNames && nameParts.length > 0 ? (
                  <span className="text-amber-500">
                    Please provide all 3 names (First, Father, and Grandfather) as shown on your account.
                  </span>
                ) : (
                  "Enter your 3 names exactly as shown on your bank or Telebirr account."
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Sender Phone Number / Account</span>
                <span className="text-[11px] font-bold text-destructive">* Required</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="e.g. 0912345678"
                  className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                />
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Screenshot Upload (Strictly Required) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                5. Transfer Receipt Screenshot
              </span>
              <span className="text-[11px] font-bold text-destructive">
                * Strictly Required
              </span>
            </div>

            {!file ? (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 p-5 cursor-pointer transition-colors text-center">
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                  <UploadCloud className="size-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">
                    Click to upload transfer receipt
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Screenshot from Telebirr or CBE Bank (Mandatory to deposit)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      className="size-14 rounded-lg object-cover border"
                    />
                  ) : (
                    <div className="size-14 rounded-lg bg-muted flex items-center justify-center">
                      <FileImage className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate max-w-[180px] sm:max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • Attached
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={handleClearFile}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Action Buttons with robust mobile formatting */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              variant="outline"
              className="h-11 sm:w-28 order-2 sm:order-1"
              onClick={() => {
                setStep("amount");
                handleClearFile();
              }}
            >
              Back
            </Button>
            <Button
              className="h-11 flex-1 font-bold text-xs sm:text-sm order-1 sm:order-2"
              onClick={handleSubmitDeposit}
              disabled={!canSubmit}
            >
              {isUploading
                ? "Submitting Deposit..."
                : !file
                ? "Attach Receipt Screenshot"
                : !isValidFullName
                ? "Enter 3 Names to Submit"
                : !isValidPhone
                ? "Enter Phone to Submit"
                : "Submit Deposit for Review"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step === "amount"
  const currentAmt = parseFloat(amountInput) || 0;
  const isValidAmount = currentAmt >= 50;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="border-b border-border/60 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ArrowUpRight className="size-5 text-emerald-500" />
          Deposit ETB
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top up your wallet via Telebirr or CBE Bank. Choose a preset or enter any custom amount.
        </p>
      </div>

      <div className="space-y-4">
        {/* Presets */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Select Preset Amount
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[50, 100, 250, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSelectPreset(amt)}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  amountInput === amt.toString()
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-border bg-muted/20 hover:bg-muted/50 text-foreground font-medium"
                }`}
              >
                <span className="text-base font-bold">{amt}</span>
                <span className="text-[11px] text-muted-foreground">ETB</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Or Enter Custom Amount (ETB)
            </label>
            <span className="text-xs text-muted-foreground">Min: 50 ETB</span>
          </div>

          <div className="relative">
            <input
              type="number"
              min={50}
              step={10}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="e.g. 150"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
              ETB
            </span>
          </div>
        </div>

        {/* Continue Button */}
        <div className="pt-2">
          <Button
            className="w-full h-11 text-base font-semibold"
            disabled={isCreating || !isValidAmount}
            onClick={handleProceedToPayment}
          >
            {isCreating
              ? "Generating Deposit Code..."
              : `Proceed to Pay ${isValidAmount ? currentAmt + " ETB" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
