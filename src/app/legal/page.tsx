import Link from "next/link";
import { ShieldCheck, FileText, Lock, Coins, ArrowRight, CheckCircle2 } from "lucide-react";

const DOCUMENTS = [
  {
    title: "Terms of Service",
    slug: "terms",
    href: "/legal/terms",
    icon: FileText,
    badge: "Core Agreement",
    description:
      "Rules governing platform gameplay, account eligibility, match stakes, fair play, anti-cheating, and mutual draw policies.",
  },
  {
    title: "Privacy Policy",
    slug: "privacy",
    href: "/legal/privacy",
    icon: Lock,
    badge: "Data Protection",
    description:
      "Details on how we collect, safeguard, and isolate personal identification and payment details under Ethiopian data protection standards.",
  },
  {
    title: "Payment & Payout Policy",
    slug: "payments",
    href: "/legal/payments",
    icon: Coins,
    badge: "Financial Guarantee",
    description:
      "Official zero-markup pass-through fee schedules for Telebirr and CBE, Net Withdrawal Guarantee, and 100 ETB minimum withdrawal rules.",
  },
];

export default function LegalOverviewPage() {
  return (
    <div className="space-y-8 sm:space-y-10 max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-primary/5 p-6 sm:p-10 backdrop-blur-md shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-4">
          <ShieldCheck className="size-4" />
          <span>Governance &amp; Transparency Center</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Abay Chess Legal &amp; Policy Portal
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          Welcome to the authoritative legal documentation and governance center for Abay Chess. We operate with radical transparency, zero platform markup on deposits and withdrawals, and strict financial ledger integrity.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>100% Net Payout Guarantee</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Zero Deposit / Withdrawal Markup</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>FIDE-Standard Fair Play Enforcement</span>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTS.map((doc) => {
          const Icon = doc.icon;
          return (
            <Link
              key={doc.slug}
              href={doc.href}
              className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 shadow-sm hover:border-primary/50 hover:bg-muted/15 transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-2">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="size-5" />
                  </span>
                  <span className="rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {doc.badge}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {doc.title}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {doc.description}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary">
                <span>Read Full Document</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
