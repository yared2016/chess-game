"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserButton, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { NavLinks, NAV_LINKS, PUBLIC_NAV_LINKS } from "@/components/nav/nav-links";
import { buttonVariants, Button } from "@/components/ui/button";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ShieldCheck,
  User,
  Wallet,
  Settings,
  History,
  Sun,
  Moon,
  LogOut,
  UserCog,
  ChevronRight,
  Sparkles,
  Target,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, focusRing, initials } from "@/lib/ui";
import { BalancePill } from "@/components/wallet/balance-pill";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { FriendsMenu } from "@/components/nav/friends-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { formatRating } from "@/lib/format";

function useProfileHref() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  return isAuthenticated && me ? `/profile/${encodeURIComponent(me.username)}` : null;
}

export function AuthNavLinks() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const profileHref = useProfileHref();
  const isAdmin = useQuery(api.admin.isAdmin, isAuthenticated ? {} : "skip");

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isActualAdmin =
    Boolean(isAdmin) &&
    (userEmail === "yaredusk@gmail.com" || user?.id === "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki");

  const links = isLoaded && isSignedIn
    ? [
        ...NAV_LINKS,
        ...(profileHref ? [{ href: profileHref, label: "Profile", className: "hidden md:inline-flex" }] : []),
        { href: "/history", label: "History", className: "hidden sm:inline-flex" },
        { href: "/wallet", label: "Wallet", className: "hidden md:inline-flex" },
        { href: "/settings", label: "Settings", className: "hidden md:inline-flex" },
        ...(isActualAdmin ? [{ href: "/yyhnan", label: "Admin", className: "hidden md:inline-flex" }] : []),
      ]
    : PUBLIC_NAV_LINKS;
  return <NavLinks links={links} />;
}

/** Mobile-exclusive profile and navigation dropdown menu */
function MobileAccountMenu({
  profileHref,
  isAdmin,
}: {
  profileHref: string | null;
  isAdmin: boolean;
}) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const username = me?.username ?? user?.username ?? user?.firstName ?? "Player";
  const avatarUrl = me?.avatarUrl ?? user?.imageUrl;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="relative sm:hidden" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Open player menu"
      >
        <Avatar className="size-8 ring-1 ring-border">
          <AvatarImage src={avatarUrl} alt={username} />
          <AvatarFallback className="text-xs font-bold">{initials(username)}</AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-72 rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3">
          {/* User Header */}
          <div className="flex items-center gap-3 border-b border-border/70 pb-3 px-1">
            <Avatar className="size-10 ring-2 ring-primary/30">
              <AvatarImage src={avatarUrl} alt={username} />
              <AvatarFallback className="text-sm font-bold">{initials(username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground truncate">{username}</p>
              <p className="text-[11px] font-mono text-muted-foreground">
                Rating: {me?.rating ? formatRating(me.rating) : "Unrated"}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-1">
            {profileHref && (
              <Link
                href={profileHref}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <User className="size-4 text-primary" />
                  <span>My Profile</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </Link>
            )}

            <Link
              href="/puzzles"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Target className="size-4 text-amber-500" />
                <span>Tactical Puzzles</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/tournaments"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Trophy className="size-4 text-indigo-500" />
                <span>Tournaments & Arenas</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/university"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className="size-4 text-emerald-500" />
                <span>University League</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <History className="size-4 text-primary" />
                <span>Match History</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/wallet"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="size-4 text-emerald-500" />
                <span>ETB Wallet</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="size-4 text-muted-foreground" />
                <span>Settings</span>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>

            {isAdmin && (
              <Link
                href="/yyhnan"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Admin Dashboard</span>
                </div>
                <ChevronRight className="size-3.5 text-primary" />
              </Link>
            )}
          </div>

          {/* Theme Toggle Switch */}
          <div className="border-t border-border/70 pt-2">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                {isDark ? <Moon className="size-4 text-amber-400" /> : <Sun className="size-4 text-amber-500" />}
                <span>{isDark ? "Dark Theme" : "Light Theme"}</span>
              </div>
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isDark ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    isDark ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="border-t border-border/70 pt-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openUserProfile();
              }}
              className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <UserCog className="size-4" />
              <span>Manage Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2.5 w-full p-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuthActions() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const profileHref = useProfileHref();
  const isAdmin = useQuery(api.admin.isAdmin, isAuthenticated ? {} : "skip");

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isActualAdmin =
    Boolean(isAdmin) &&
    (userEmail === "yaredusk@gmail.com" || user?.id === "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki");

  if (!isLoaded) {
    // Same footprint as the two buttons so the header does not shift on hydration.
    return <div aria-hidden className="h-8 w-[8.25rem]" />;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <FriendsMenu />
        <NotificationsMenu />
        <BalancePill />

        {/* Desktop UserButton */}
        <div className="hidden sm:block">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link label="Match History" labelIcon={<History size={16} />} href="/history" />
              {isActualAdmin ? (
                <UserButton.Link label="Admin Dashboard" labelIcon={<ShieldCheck size={16} />} href="/yyhnan" />
              ) : null}
            </UserButton.MenuItems>
          </UserButton>
        </div>

        {/* Mobile Full Feature Menu */}
        <MobileAccountMenu profileHref={profileHref} isAdmin={Boolean(isActualAdmin)} />
      </div>
    );
  }

  return (
    <>
      <Link
        href="/sign-in"
        prefetch={false}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Sign in
      </Link>
      <Link href="/sign-up" prefetch={false} className={buttonVariants({ size: "sm" })}>
        Sign up
      </Link>
    </>
  );
}

/** Landing-page call to action; same reasoning as `AuthActions`. */
export function HeroActions() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <>
        <Link prefetch={false} href="/play" className={buttonVariants({ size: "lg" })}>
          Play now
        </Link>
        <Link prefetch={false} href="/leaderboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Leaderboard
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-up" prefetch={false} className={buttonVariants({ size: "lg" })}>
        Create an account
      </Link>
      <Link
        href="/sign-in"
        prefetch={false}
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Sign in
      </Link>
    </>
  );
}
