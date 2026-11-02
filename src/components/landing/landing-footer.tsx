// src/components/landing/landing-footer.tsx [U1]
// Clean, professional footer with platform brand, navigation, and legal links.
// Open source license notices and attributions are maintained in /legal/licenses.
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cn, focusRing } from "@/lib/ui";

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/legal", label: "Legal" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/payments", label: "Payments" },
  { href: "/legal/licenses", label: "Licenses" },
  { href: "/sign-in", label: "Sign in" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto w-full max-w-[80rem] px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <BrandLogo variant="footer" href="/" priority={false} />
            <p className="mt-4 max-w-[42ch] text-[13px] text-muted-foreground">
              An online 3D chess platform with rooms you can sit in. Free, and it runs in your browser.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV.map((item) => (
              <Link
                prefetch={item.href !== "/sign-in"}
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md px-2 -mx-2 text-[13px]",
                  "text-muted-foreground transition-colors duration-(--dur-micro) hover:text-foreground",
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-border/60 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <p>&copy; {new Date().getFullYear()} Abay Chess. All rights reserved.</p>
          <p className="text-[11px]">Secure real-time multiplayer chess with instant verified ETB settlements.</p>
        </div>
      </div>
    </footer>
  );
}
