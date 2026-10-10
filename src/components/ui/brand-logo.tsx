"use client";

import Image from "next/image";
import Link from "next/link";
import { cn, focusRing } from "@/lib/ui";

export interface BrandLogoProps {
  /**
   * - "header": Tailored for navbar with responsive compact emblem on mobile & full wordmark on desktop.
   * - "full": Full official ABAY CHESS master logo image (1:1 square).
   * - "emblem": Compact knight emblem image (1:1 square, no text, ideal for small viewports & avatars).
   * - "auth": Sized and styled for authentication cards (sign-in / sign-up).
   * - "footer": Sized and styled for the footer section.
   */
  variant?: "header" | "full" | "emblem" | "auth" | "footer";
  className?: string;
  imageClassName?: string;
  href?: string;
  priority?: boolean;
  size?: number;
}

export function BrandLogo({
  variant = "header",
  className,
  imageClassName,
  href,
  priority = false,
  size,
}: BrandLogoProps) {
  // Content according to variant
  let content: React.ReactNode = null;

  if (variant === "header") {
    content = (
      <div className={cn("flex items-center gap-2.5", className)}>
        {/* Emblem: visible at all screen sizes, perfect responsive anchor */}
        <div className="relative flex size-8 sm:size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-500/20 bg-black/40 shadow-xs ring-1 ring-white/5 transition-transform duration-200 group-hover:scale-105">
          <Image
            src="/images/brand/abay-chess-emblem.png"
            alt="Abay Chess"
            width={36}
            height={36}
            priority={priority}
            className={cn("size-full object-cover", imageClassName)}
          />
        </div>

        {/* Wordmark: shown on tablet and desktop (>= 640px) */}
        <div className="hidden sm:flex flex-col justify-center leading-none select-none">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[0.9375rem] font-black tracking-wider text-foreground uppercase">
              ABAY
            </span>
            <span className="text-xs font-bold tracking-[0.18em] text-[#E5A93C] uppercase">
              CHESS
            </span>
          </div>
          <span className="text-[9px] font-medium tracking-[0.22em] text-muted-foreground/70 uppercase">
            PLAY • COMPETE • GROW
          </span>
        </div>
      </div>
    );
  } else if (variant === "emblem") {
    const dim = size || 40;
    content = (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-500/20 bg-black shadow-xs",
          className,
        )}
        style={{ width: dim, height: dim }}
      >
        <Image
          src="/images/brand/abay-chess-emblem.png"
          alt="Abay Chess"
          width={dim}
          height={dim}
          priority={priority}
          className={cn("size-full object-cover", imageClassName)}
        />
      </div>
    );
  } else if (variant === "auth") {
    const dim = size || 80;
    content = (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black shadow-lg shadow-amber-950/20 ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105",
          className,
        )}
        style={{ width: dim, height: dim }}
      >
        <Image
          src="/images/brand/abay-chess-emblem.png"
          alt="Abay Chess"
          width={dim}
          height={dim}
          priority={priority}
          className={cn("size-full object-cover", imageClassName)}
        />
      </div>
    );
  } else if (variant === "footer") {
    content = (
      <div className={cn("flex items-center gap-3.5", className)}>
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-500/30 bg-black shadow-sm ring-1 ring-white/10">
          <Image
            src="/images/brand/abay-chess-emblem.png"
            alt="Abay Chess"
            width={48}
            height={48}
            priority={priority}
            className={cn("size-full object-cover", imageClassName)}
          />
        </div>
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-black tracking-wider text-foreground uppercase">
              ABAY
            </span>
            <span className="text-base font-bold tracking-[0.2em] text-[#E5A93C] uppercase">
              CHESS
            </span>
          </div>
          <span className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-muted-foreground/80 uppercase">
            PLAY • COMPETE • GROW
          </span>
        </div>
      </div>
    );
  } else {
    // variant === "full"
    const dim = size || 120;
    content = (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/20 bg-black shadow-md",
          className,
        )}
        style={{ width: dim, height: dim }}
      >
        <Image
          src="/images/brand/abay-chess-logo.png"
          alt="Abay Chess"
          width={dim}
          height={dim}
          priority={priority}
          className={cn("size-full object-contain", imageClassName)}
        />
      </div>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-label="Abay Chess — Home"
        className={cn("group inline-flex items-center rounded-lg", focusRing)}
      >
        {content}
      </Link>
    );
  }

  return content;
}
