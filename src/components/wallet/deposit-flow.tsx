"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export function DepositFlow() {
  const [step, setStep] = useState<"amount" | "payment" | "status">("amount");
  const [amount, setAmount] = useState(0);
  const [depositCode, setDepositCode] = useState("");
  const [depositId, setDepositId] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createDeposit = useMutation(api.deposits?.create as any);
  const generateUploadUrl = useMutation(api.storage?.generateUploadUrl as any);
  const uploadScreenshot = useMutation(api.deposits?.uploadScreenshot as any);

  const handleSelectAmount = async (selectedAmount: number) => {
    try {
      setAmount(selectedAmount);
      // Assuming api.deposits.create returns { code, id }
      const res = await createDeposit({ amount: selectedAmount });
      setDepositCode(res.code || `CAS-${Math.floor(Math.random() * 10000)}`);
      setDepositId(res.id || res._id);
      setStep("payment");
    } catch (error: any) {
      toast.error(error.message || "Failed to create deposit");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a screenshot first");
      return;
    }

    try {
      setIsUploading(true);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();

      await uploadScreenshot({ depositId, storageId });
      setStep("status");
      toast.success("Deposit submitted successfully");
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (step === "amount") {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium">Select Amount to Deposit</h3>
        <div className="grid grid-cols-2 gap-4">
          {[50, 100, 200, 500].map((amt) => (
            <Button
              key={amt}
              variant="outline"
              className="h-20 text-lg"
              onClick={() => handleSelectAmount(amt)}
            >
              {amt} ETB
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-medium">Payment Instructions</h3>
        <div className="rounded-lg bg-secondary p-4 space-y-4">
          <p>
            1. Send <strong>{amount} ETB</strong> via Telebirr to Merchant ID:{" "}
            <strong>{process.env.NEXT_PUBLIC_TELEBIRR_MERCHANT_ID || "Your Merchant ID"}</strong>
          </p>
          <div className="flex flex-col gap-2">
            <p>2. Use this exact code as the reason/remark:</p>
            <div className="flex items-center gap-2 bg-background p-2 rounded border">
              <span className="font-mono flex-1 text-center font-bold text-lg">{depositCode}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(depositCode);
                  toast.success("Code copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p>3. Upload a screenshot of the completed transaction:</p>
            <input
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <Button onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? "Uploading..." : "Submit Screenshot"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="rounded-full bg-green-500/20 p-4 text-green-500">
        ✓
      </div>
      <h3 className="text-xl font-medium">Submitted — waiting for approval</h3>
      <p className="text-muted-foreground">
        We are reviewing your deposit. Your balance will be updated once approved.
      </p>
      <Button variant="outline" onClick={() => setStep("amount")}>
        Make another deposit
      </Button>
    </div>
  );
}
