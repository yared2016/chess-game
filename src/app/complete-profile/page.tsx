import type { Metadata } from "next";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata: Metadata = {
  title: "Profile & Payout Settings · Abay Chess",
  description: "Set up and manage your Abay Chess profile and withdrawal payout methods.",
};

export default function CompleteProfilePage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3">
            <BrandLogo variant="auth" href="/" priority size={64} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Profile & Payout Settings
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            Manage your verified player identity, contact info, and withdrawal payout accounts on Abay Chess.
          </p>
        </div>

        {/* Form Container Card */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <CompleteProfileForm />
        </div>
      </div>
    </div>
  );
}
