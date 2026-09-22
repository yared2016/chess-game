"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowUpRight, Check, CheckCircle2, Copy, FileImage, ImagePlus, Phone, UploadCloud, X } from "lucide-react";

export function DepositFlow() {
  const [step, setStep] = useState<"amount" | "payment" | "status">("amount");
  const [amountInput, setAmountInput] = useState<string>("100");
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [depositCode, setDepositCode] = useState<string>("");
  const [depositId, setDepositId] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createDeposit = useMutation(api.deposits?.create as any);
  const generateUploadUrl = useMutation(api.storage?.generateUploadUrl as any);
  const uploadScreenshot = useMutation(api.deposits?.uploadScreenshot as any);

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
        toast.error("Please upload an image file (PNG, JPG, etc.)");
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

  const handleCopyCode = () => {
    if (!depositCode) return;
    navigator.clipboard.writeText(depositCode);
    setCopied(true);
    toast.success("Deposit code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadScreenshot = async () => {
    if (!file) {
      toast.error("Please select your payment screenshot first");
      return;
    }
    if (!depositId) {
      toast.error("Deposit session expired. Please start over.");
      return;
    }

    try {
      setIsUploading(true);
      // 1. Get Convex direct storage upload URL
      const postUrl = await generateUploadUrl();
      // 2. Post file directly to Convex storage
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Screenshot upload failed");
      const { storageId } = await result.json();

      // 3. Link storageId to deposit record
      await uploadScreenshot({ depositId, storageId });
      setStep("status");
      toast.success("Deposit and screenshot submitted for review!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload screenshot");
    } finally {
      setIsUploading(false);
    }
  };

  if (step === "status") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-full bg-green-500/10 p-4 text-green-500 ring-8 ring-green-500/5">
          <CheckCircle2 className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Deposit Submitted for Review</h3>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          We received your deposit request of <strong>{depositAmount} ETB</strong> with reference code{" "}
          <strong className="font-mono text-foreground font-bold">{depositCode}</strong> and screenshot. Your wallet balance will be credited as soon as an admin approves it (usually within 5–15 minutes).
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep("amount");
              setFile(null);
              setPreviewUrl(null);
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
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ArrowUpRight className="size-5 text-green-500" />
              Complete Your Deposit
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send exact payment and upload the screenshot.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">Amount</span>
            <span className="text-lg font-extrabold text-green-500">{depositAmount} ETB</span>
          </div>
        </div>

        {/* Step-by-Step Payment Instructions */}
        <div className="space-y-4">
          {/* Step 1: Telebirr instructions */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Phone className="size-4" />
              <span>Step 1: Send via Telebirr or CBE</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Open your <strong>Telebirr</strong> app (or CBE Birr), choose transfer/pay, and send exactly{" "}
              <strong className="text-foreground">{depositAmount} ETB</strong> to:
            </p>
            <div className="flex items-center justify-between rounded-lg bg-background/80 border p-2.5">
              <div>
                <span className="text-[11px] text-muted-foreground block uppercase">Telebirr Merchant / Phone</span>
                <span className="text-sm sm:text-base font-bold text-foreground">
                  {process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_ID || "0911223344"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => {
                  navigator.clipboard.writeText(process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_ID || "0911223344");
                  toast.success("Merchant number copied");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
          </div>

          {/* Step 2: Code Remark */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider block">
              Step 2: Put this Reference Code in the Remark
            </span>
            <p className="text-xs text-muted-foreground">
              You must include this code in the transaction remark/reason so our admins can verify your account:
            </p>
            <div className="flex items-center justify-between rounded-lg bg-background border border-amber-500/30 p-3">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-primary">
                {depositCode}
              </span>
              <Button
                size="sm"
                variant={copied ? "default" : "outline"}
                className="h-9 gap-1.5 text-xs font-bold"
                onClick={handleCopyCode}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy Code"}
              </Button>
            </div>
          </div>

          {/* Step 3: Screenshot Upload */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Step 3: Upload Receipt Screenshot
            </span>

            {!file ? (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 p-6 cursor-pointer transition-colors text-center">
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <UploadCloud className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Click to upload payment receipt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, or screenshot image</p>
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
                      {(file.size / 1024).toFixed(1)} KB • Ready to submit
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => {
                setStep("amount");
                handleClearFile();
              }}
            >
              Back
            </Button>
            <Button
              className="flex-[2] h-11 font-semibold text-base"
              onClick={handleUploadScreenshot}
              disabled={!file || isUploading}
            >
              {isUploading ? "Uploading Receipt..." : "Submit Receipt"}
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
          <ArrowUpRight className="size-5 text-green-500" />
          Deposit ETB
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top up your wallet via Telebirr or CBE Birr. Choose a preset or enter any custom amount.
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
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
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
