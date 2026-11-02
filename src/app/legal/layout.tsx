import type { Metadata } from "next";
import { LegalSubNav } from "@/components/legal/legal-sub-nav";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Legal & Governance Portal | Abay Chess",
  description: "Official legal documents, terms of service, privacy policy, and payment guarantees for Abay Chess.",
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Streamlined secondary sub-navigation docked directly below SiteHeader (sticky top-14) */}
      <LegalSubNav />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
