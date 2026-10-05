"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  User,
  Swords,
  UserX,
  Ban,
  X,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";

export interface FriendActionTarget {
  _id: string;
  friendshipId?: string;
  username: string;
  avatarUrl?: string;
  rating?: number;
  ratingHuman?: number;
}

interface FriendActionSheetProps {
  friend: FriendActionTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChallenge: (username: string) => void;
  onRemoveFriend: (friendshipId: any, username: string, playerId?: any) => Promise<void>;
  onBlockPlayer: (blockedId: any, username: string) => Promise<void>;
  forceRenderInServer?: boolean;
}

export function FriendActionSheet({
  friend,
  open,
  onOpenChange,
  onChallenge,
  onRemoveFriend,
  onBlockPlayer,
  forceRenderInServer = false,
}: FriendActionSheetProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"actions" | "confirm-remove" | "confirm-block">("actions");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to actions mode whenever dialog opens or friend changes
  useEffect(() => {
    if (open) {
      setMode("actions");
      setIsSubmitting(false);
    }
  }, [open, friend?._id]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode !== "actions") {
          setMode("actions");
        } else {
          onOpenChange(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, mode, onOpenChange]);

  if ((!mounted && !forceRenderInServer) || !open || !friend) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setMode("actions");
    onOpenChange(false);
  };

  const handleViewProfile = () => {
    handleClose();
    router.push(`/profile/${encodeURIComponent(friend.username)}`);
  };

  const handlePlayMatch = () => {
    handleClose();
    onChallenge(friend.username);
  };

  const handleConfirmRemove = async () => {
    try {
      setIsSubmitting(true);
      await onRemoveFriend(friend.friendshipId, friend.username, friend._id);
      handleClose();
    } catch {
      // Error toast already handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmBlock = async () => {
    try {
      setIsSubmitting(true);
      await onBlockPlayer(friend._id, friend.username);
      handleClose();
    } catch {
      // Error toast already handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingValue = friend.ratingHuman ?? friend.rating;

  const sheetContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs duration-200 animate-in fade-in-0"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet / Dialog Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-action-title"
        className={cn(
          "relative z-[101] w-full bg-card/95 border border-border/80 shadow-2xl backdrop-blur-2xl transition-all duration-200",
          // Mobile: Bottom Sheet
          "rounded-t-3xl border-b-0 p-5 animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto",
          // Desktop: Centered Floating Modal
          "sm:max-w-md sm:rounded-3xl sm:border sm:p-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:fade-in-0"
        )}
      >
        {/* Mobile Swipe / Drag Indicator */}
        <div className="flex sm:hidden justify-center pb-3 -mt-1" aria-hidden="true">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 sm:right-5 sm:top-5 size-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* 1. MAIN ACTIONS VIEW */}
        {mode === "actions" && (
          <div className="space-y-5">
            {/* Friend Identity Header */}
            <div className="flex items-center gap-3.5 pr-8">
              <div className="relative shrink-0">
                <Avatar className="size-13 ring-2 ring-emerald-500/30 shadow-md">
                  <AvatarImage src={friend.avatarUrl} alt={friend.username} />
                  <AvatarFallback className="text-sm font-bold bg-muted text-foreground">
                    {initials(friend.username)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse"
                  title="Online"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <h3
                  id="friend-action-title"
                  className="text-base font-black text-foreground truncate tracking-tight"
                >
                  {friend.username}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-mono font-bold text-primary">
                    <span>{ratingValue ? formatRating(ratingValue) : "Unrated"}</span>
                    <span className="text-[10px] text-muted-foreground">ELO</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">Friend</span>
                </div>
              </div>
            </div>

            {/* Quick Action List */}
            <div className="space-y-2 pt-1">
              {/* Play Match (Primary) */}
              <button
                type="button"
                onClick={handlePlayMatch}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Swords className="size-4.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold leading-tight">Play Match</div>
                    <div className="text-[11px] text-white/80 font-normal">Challenge to casual or staked game</div>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
                  Play
                </span>
              </button>

              {/* View Profile */}
              <button
                type="button"
                onClick={handleViewProfile}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 hover:bg-muted border border-border/70 text-foreground font-semibold text-sm transition-all text-left active:scale-[0.99]"
              >
                <div className="size-9 rounded-xl bg-card border border-border/80 flex items-center justify-center text-primary shadow-xs">
                  <User className="size-4.5" />
                </div>
                <div>
                  <div className="font-bold leading-tight">View Profile</div>
                  <div className="text-[11px] text-muted-foreground">Check stats, match history, and achievements</div>
                </div>
              </button>
            </div>

            {/* Danger Zone Actions */}
            <div className="pt-2 border-t border-border/60 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 block">
                Manage Connection
              </span>

              <div className="grid grid-cols-2 gap-2">
                {/* Remove Friend */}
                <button
                  type="button"
                  onClick={() => setMode("confirm-remove")}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-xs font-bold transition-colors"
                >
                  <UserX className="size-3.5" />
                  <span>Remove Friend</span>
                </button>

                {/* Block Player */}
                <button
                  type="button"
                  onClick={() => setMode("confirm-block")}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive text-xs font-bold transition-colors"
                >
                  <Ban className="size-3.5" />
                  <span>Block Player</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. CONFIRM REMOVE FRIEND VIEW */}
        {mode === "confirm-remove" && (
          <div className="space-y-4 py-1 text-center sm:text-left">
            <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto sm:mx-0 shadow-xs">
              <AlertTriangle className="size-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-foreground">
                Remove {friend.username} from friends?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                They will be removed from your friends list and you won&apos;t receive their direct presence updates. You can always send them a friend request again later.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setMode("actions")}
                className="w-full sm:flex-1 h-10 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmRemove}
                className="w-full sm:flex-1 h-10 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white gap-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <UserX className="size-3.5" />
                    <span>Yes, Remove</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 3. CONFIRM BLOCK PLAYER VIEW */}
        {mode === "confirm-block" && (
          <div className="space-y-4 py-1 text-center sm:text-left">
            <div className="size-12 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mx-auto sm:mx-0 shadow-xs">
              <ShieldAlert className="size-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-foreground">
                Block {friend.username}?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Blocked players cannot challenge you to games, send friend requests, or chat with you. You can unblock them at any time from your Blocked list.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setMode("actions")}
                className="w-full sm:flex-1 h-10 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmBlock}
                className="w-full sm:flex-1 h-10 rounded-xl font-bold text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Blocking...</span>
                  </>
                ) : (
                  <>
                    <Ban className="size-3.5" />
                    <span>Yes, Block Player</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (forceRenderInServer || typeof document === "undefined") {
    return sheetContent;
  }

  return createPortal(sheetContent, document.body);
}
