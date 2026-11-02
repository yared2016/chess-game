import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ShieldCheck, FileText, Lock, Coins, Award, ArrowLeft } from "lucide-react";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Legal & Governance Portal | Abay Chess",
  description: "Official legal documents, terms of service, privacy policy, payment guarantees, and open-source licenses for Abay Chess.",
};

const LEGAL_NAV = [
  { href: "/legal", label: "Overview", icon: ShieldCheck },
  { href: "/legal/terms", label: "Terms of Service", icon: FileText },
  { href: "/legal/privacy", label: "Privacy Policy", icon: Lock },
  { href: "/legal/payments", label: "Payments & Tariffs", icon: Coins },
  { href: "/legal/licenses", label: "Open Source Licenses", icon: Award },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo variant="header" href="/" priority size={32} />
            <div className="h-4 w-px bg-border" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Legal &amp; Governance
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Chess</span>
            </Link>
          </div>
        </div>

        {/* Sub-nav Tab Bar */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 overflow-x-auto no-scrollbar border-t border-border/40">
          <nav className="flex space-x-1 sm:space-x-2 py-2" aria-label="Legal Sections">
            {LEGAL_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
