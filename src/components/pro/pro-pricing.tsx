"use client";
// src/components/pro/pro-pricing.tsx  [PRO_TUTOR §1, §2, §7]
// The price band of /pro: Clerk's `<PricingTable/>` in a sunken well, plus the
// welcome state members land on after checkout.
//
// The price itself is never written here. It lives in the Clerk plan (`pro`, 900
// cents) and the component prints it, so the page cannot drift from what a member is
// actually charged. `newSubscriptionRedirectUrl` and the one `session.reload()` on
// arrival are §2's fix for the session token still saying "free" for a few seconds
// after a successful payment.
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Display, Section } from "@/components/ui-kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearTutorReturn, readTutorReturn, useTutorAccess } from "@/components/tutor/access";
import { PRO_ETB_PRICE } from "@/lib/constants";
import { cn, focusRing } from "@/lib/ui";
import "./pro.css";

/** Convex ids are opaque lowercase strings; anything else in storage is not a game. */
const GAME_ID = /^[a-z0-9]{16,64}$/i;


function EtbProCard() {
  const { isSignedIn } = useAuth();
  const balance = useQuery(api.wallets.getBalance, isSignedIn ? {} : "skip");
  const me = useQuery(api.players.me, isSignedIn ? {} : "skip");
  const buyPro = useMutation(api.wallets.buyProWithEtb);
  const [loading, setLoading] = useState(false);

  const hasActivePro = Boolean(me?.proUntil && me.proUntil > Date.now());
  const formattedDate = me?.proUntil
    ? new Date(me.proUntil).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function handleBuy() {
    setLoading(true);
    try {
      await buyPro({});
      toast.success("Pro membership activated for 30 days!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to activate Pro membership.");
    } finally {
      setLoading(false);
    }
  }

  const available = balance?.available ?? 0;
  const canAfford = available >= PRO_ETB_PRICE;

  return (
    <div className="flex flex-col justify-between rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={13} />
            Ethiopian Birr (Telebirr / CBE)
          </span>
          {hasActivePro && (
            <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
              Active until {formattedDate}
            </span>
          )}
        </div>

        <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Castle Pro
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay easily in ETB with zero international card fees.
        </p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-4xl font-extrabold tracking-tight text-foreground">
            {PRO_ETB_PRICE}
          </span>
          <span className="text-base font-semibold text-foreground">ETB</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>

        <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span>AI Chess Coach in every game</span>
          </li>
          <li className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span>Real-time board arrows & move ideas</span>
          </li>
          <li className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span>Ask questions during analysis</span>
          </li>
          <li className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span>Instant activation with wallet balance</span>
          </li>
        </ul>
      </div>

      <div className="mt-8 border-t border-border pt-4">
        {!isSignedIn ? (
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ size: "lg" }), "w-full min-h-11")}
          >
            Sign in to subscribe
          </Link>
        ) : canAfford ? (
          <Button
            size="lg"
            onClick={handleBuy}
            disabled={loading}
            className="w-full min-h-11 font-semibold"
          >
            {loading ? "Activating…" : hasActivePro ? "Extend 30 Days (150 ETB)" : "Unlock Pro with Wallet (150 ETB)"}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Your balance: {available} ETB</span>
              <span>Need: {PRO_ETB_PRICE} ETB</span>
            </div>
            <Link
              href="/wallet"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full min-h-11 font-semibold")}
            >
              Deposit ETB to Unlock
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProPricing() {
  return (
    <Section id="plans" padding="none" className="scroll-mt-20 py-8 sm:py-12">
      <Display level={3} as="h2" className="text-center">
        Upgrade to Castle Pro
      </Display>

      {/* `useSearchParams` needs a boundary for the rest of the page to stay static. */}
      <Suspense fallback={null}>
        <WelcomeNotice />
      </Suspense>

      <div className="mx-auto mt-8 max-w-md">
        <EtbProCard />
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
        Direct ETB payment via Telebirr or CBE. 30 days access per activation. Cancel or renew anytime.
      </p>
    </Section>
  );
}

/**
 * The state a member arrives in from checkout (`/pro?welcome=1`).
 *
 * `has` is read from the session token, and the token that came back from checkout
 * predates the subscription — so the session is reloaded exactly once here before the
 * answer is believed. The ref, not a state flag, is what makes it once: `isLoaded`
 * flipping and Clerk's context re-identifying would otherwise both re-run the effect.
 */
function WelcomeNotice() {
  const welcome = useSearchParams().get("welcome") === "1";
  const clerk = useClerk();
  const { hasTutor } = useTutorAccess();
  // One piece of state, written once, from a callback rather than from the effect
  // body: two synchronous setState calls in an effect are two cascading renders.
  const [arrival, setArrival] = useState<{ reloaded: boolean; returnTo: string | null }>({
    reloaded: false,
    returnTo: null,
  });
  const started = useRef(false);

  useEffect(() => {
    if (!welcome || started.current || !clerk.loaded) return;
    started.current = true;

    void (async () => {
      const stored = readTutorReturn();
      try {
        await clerk.session?.reload();
      } catch {
        /* the token refreshes itself on the next navigation either way. */
      }
      setArrival({ reloaded: true, returnTo: stored && GAME_ID.test(stored) ? stored : null });
    })();
  }, [welcome, clerk, clerk.loaded]);

  const { reloaded, returnTo } = arrival;

  if (!welcome) return null;

  if (!reloaded || hasTutor === undefined) {
    return (
      <p role="status" className="mt-6 text-[15px] text-muted-foreground">
        Checking your membership…
      </p>
    );
  }

  if (!hasTutor) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h3 className="text-[1.25rem] leading-tight font-semibold tracking-tight text-foreground">
          Not switched over yet
        </h3>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
          The payment has gone through but your plan has not caught up. Reload this page in a
          moment and the tutor will be there.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 min-h-11")}
        >
          Reload the page
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-display text-[2rem] leading-[1.1] tracking-[-0.01em] text-foreground">
        You are in.
      </h3>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
        The tutor is waiting on the left of the board, in every game you play or watch.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {returnTo ? (
          <Link
            prefetch={false}
            href={`/game/${returnTo}`}
            onClick={clearTutorReturn}
            className={cn(buttonVariants({ size: "lg" }), "min-h-11", focusRing)}
          >
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Back to the game
          </Link>
        ) : (
          <Link
            prefetch={false}
            href="/play"
            className={cn(buttonVariants({ size: "lg" }), "min-h-11", focusRing)}
          >
            Find a match
          </Link>
        )}
      </div>
    </div>
  );
}
