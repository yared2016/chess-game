"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  User,
  UserPlus,
  UserCheck,
  UserX,
  Swords,
  Search,
  Check,
  X,
  Clock,
  Ban,
  MoreVertical,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";
import { useKeyboardMetrics } from "@/components/game/use-viewport";

export function FriendsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add" | "blocked">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeActionFriendId, setActiveActionFriendId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isOpen: isKeyboardOpen } = useKeyboardMetrics();

  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useConvexAuth();

  // Queries
  const friends = useQuery(api.friends.myFriends, open && isAuthenticated ? {} : "skip");
  const incomingRequests = useQuery(api.friends.myIncomingRequests, isAuthenticated ? {} : "skip");
  const outgoingRequests = useQuery(api.friends.myOutgoingRequests, open && isAuthenticated ? {} : "skip");
  const blocks = useQuery(api.friends.myBlocks, open && isAuthenticated ? {} : "skip");

  // Search results for adding friends
  const searchResults = useQuery(
    (api as any).challenges?.searchPlayers,
    open && activeTab === "add" && searchQuery.trim().length >= 2
      ? { query: searchQuery.trim() }
      : "skip"
  );

  // Mutations
  const sendRequest = useMutation(api.friends.sendRequest);
  const respond = useMutation(api.friends.respond);
  const cancelRequest = useMutation(api.friends.cancelRequest);
  const removeFriend = useMutation(api.friends.removeFriend);
  const blockPlayer = useMutation(api.friends.blockPlayer);
  const unblockPlayer = useMutation(api.friends.unblockPlayer);

  const pendingIncomingCount = incomingRequests?.length ?? 0;

  // Close menu on click outside, but ignore clicks in portals or toasts
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (menuRef.current && menuRef.current.contains(target)) {
        if (!target.closest(".friend-options-menu") && !target.closest(".friend-options-trigger")) {
          setActiveActionFriendId(null);
        }
        return;
      }

      // Ignore clicks inside portaled dialogs, menus, or Sonner toasts
      if (
        target.closest("[data-slot^='dropdown-menu']") ||
        target.closest("[data-slot^='dialog']") ||
        target.closest("[data-slot^='alert-dialog']") ||
        target.closest("[data-sonner-toast]") ||
        target.closest("[role='menu']") ||
        target.closest("[role='menuitem']")
      ) {
        return;
      }

      setOpen(false);
      setActiveActionFriendId(null);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Actions
  const handleSendFriendRequest = async (toPlayerId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await sendRequest({ toPlayerId });
      toast.success(`Friend request sent to ${username}!`);
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to send friend request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (friendshipId: any, accept: boolean, username: string) => {
    try {
      setIsSubmitting(true);
      await respond({ friendshipId, accept });
      if (accept) {
        toast.success(`You and ${username} are now friends!`);
      } else {
        toast.info(`Declined friend request from ${username}`);
      }
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to respond to request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (friendshipId: any) => {
    try {
      setIsSubmitting(true);
      await cancelRequest({ friendshipId });
      toast.info("Friend request cancelled");
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to cancel request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFriend = async (friendshipId: any, username: string, friendPlayerId?: any) => {
    try {
      setIsSubmitting(true);
      await removeFriend({
        friendshipId: friendshipId || undefined,
        playerId: friendPlayerId || undefined,
      });
      setActiveActionFriendId(null);
      toast.info(`Removed ${username} from friends`);
    } catch (err: any) {
      console.error("Failed to remove friend:", err);
      toast.error(describeConvexError(err, "Failed to remove friend"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlockPlayer = async (blockedId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await blockPlayer({ blockedId });
      setActiveActionFriendId(null);
      toast.info(`Blocked ${username}. They can no longer challenge you.`);
    } catch (err: any) {
      console.error("Failed to block player:", err);
      toast.error(describeConvexError(err, "Failed to block player"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblockPlayer = async (blockedId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await unblockPlayer({ blockedId });
      toast.success(`Unblocked ${username}`);
    } catch (err: any) {
      console.error("Failed to unblock player:", err);
      toast.error(describeConvexError(err, "Failed to unblock player"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChallenge = (username: string) => {
    setOpen(false);
    router.push(`/play?mode=direct&challenge=${encodeURIComponent(username)}`);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        aria-label="Friends & Social"
        className={cn(
          "relative shrink-0 transition-colors rounded-xl",
          open
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <Users className="size-4.5" />
        {pendingIncomingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-75">
            {pendingIncomingCount}
          </span>
        )}
      </Button>

      {/* Popover Card */}
      {open && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-sm sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:w-[26rem] z-50 rounded-3xl border border-border/80 bg-card/98 backdrop-blur-xl shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 transition-all",
            isKeyboardOpen
              ? "top-3 max-h-[calc(100dvh-1.5rem)]"
              : "top-14 sm:top-full sm:mt-2 max-h-[calc(100dvh-4.5rem)] sm:max-h-[36rem]"
          )}
          style={
            isKeyboardOpen && typeof window !== "undefined" && window.visualViewport
              ? {
                  maxHeight: `${Math.max(220, window.visualViewport.height - 24)}px`,
                }
              : undefined
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-primary/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-xs">
                <Users className="size-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-foreground tracking-tight">Friends & Social</h3>
                  <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {friends ? `${friends.length} ${friends.length === 1 ? "friend" : "friends"} connected` : "Loading..."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveActionFriendId(null);
              }}
              className="size-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label="Close friends menu"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 my-2.5 p-1 rounded-2xl bg-muted/50 border border-border/60 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("friends")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1",
                activeTab === "friends"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>Friends</span>
              <span className="text-[10px] font-mono opacity-80">({friends?.length ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 relative",
                activeTab === "requests"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <span>Requests</span>
              {pendingIncomingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                  {pendingIncomingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("add")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1",
                activeTab === "add"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <UserPlus className="size-3.5" />
              <span>Add</span>
            </button>

            {blocks && blocks.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("blocked")}
                className={cn(
                  "py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center",
                  activeTab === "blocked"
                    ? "bg-card text-destructive shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-destructive hover:bg-muted/40"
                )}
                title="Blocked Players"
              >
                <Ban className="size-3.5" />
              </button>
            )}
          </div>

          {/* Tab 1: Friends List */}
          {activeTab === "friends" && (
            <div
              className="space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 scrollbar-thin"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {!friends || friends.length === 0 ? (
                <div className="py-9 px-4 text-center space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/10">
                  <div className="size-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                    <Users className="size-5.5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">No friends added yet</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                      Connect with other players to easily challenge them to casual or staked matches anytime.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("add")}
                    className="mt-1 text-xs font-bold gap-1.5 rounded-xl shadow-xs"
                  >
                    <UserPlus className="size-3.5" /> Find & Add Players
                  </Button>
                </div>
              ) : (
                friends.map((friend, index) => {
                  const isMenuOpen = activeActionFriendId === friend._id;
                  const isLastItem = index === friends.length - 1 && friends.length > 2;

                  return (
                    <div
                      key={friend._id}
                      className={cn(
                        "p-2.5 rounded-2xl border transition-all shadow-xs relative",
                        isMenuOpen
                          ? "border-primary/50 bg-card ring-1 ring-primary/20"
                          : "border-border/60 bg-card hover:border-primary/30 hover:bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/profile/${encodeURIComponent(friend.username)}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
                        >
                          <div className="relative shrink-0">
                            <Avatar className="size-9 ring-1 ring-border shadow-xs">
                              <AvatarImage src={friend.avatarUrl} alt={friend.username} />
                              <AvatarFallback className="text-xs font-bold">
                                {initials(friend.username)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">
                              {friend.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                              <span className="text-primary font-bold">{formatRating(friend.ratingHuman ?? friend.rating)}</span>
                              <span>ELO</span>
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="xs"
                            onClick={() => handleChallenge(friend.username)}
                            className="h-7 px-2.5 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                            title="Challenge to match"
                          >
                            <Swords className="size-3" />
                            Play
                          </Button>

                          <div className="relative">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionFriendId(isMenuOpen ? null : friend._id);
                              }}
                              aria-label={`Options for ${friend.username}`}
                              className={cn(
                                "friend-options-trigger size-7 rounded-xl transition-colors shrink-0",
                                isMenuOpen
                                  ? "bg-primary/20 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                              )}
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>

                            {/* Floating Dropdown Menu matching media_1790494312961.png */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "friend-options-menu absolute right-0 w-44 rounded-2xl border border-border/80 bg-popover/98 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-100",
                                  isLastItem ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionFriendId(null);
                                    setOpen(false);
                                    router.push(`/profile/${encodeURIComponent(friend.username)}`);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 rounded-xl transition-colors text-left cursor-pointer"
                                >
                                  <User className="size-3.5 text-primary shrink-0" />
                                  <span>View Profile</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionFriendId(null);
                                    handleChallenge(friend.username);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 rounded-xl transition-colors text-left cursor-pointer"
                                >
                                  <Swords className="size-3.5 text-emerald-500 shrink-0" />
                                  <span>Challenge</span>
                                </button>

                                <div className="my-1 border-t border-border/60" />

                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleRemoveFriend(
                                      friend.friendshipId,
                                      friend.username,
                                      friend._id
                                    );
                                  }}
                                  className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors text-left disabled:opacity-50 cursor-pointer"
                                >
                                  <UserX className="size-3.5 shrink-0" />
                                  <span>Unfriend</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleBlockPlayer(friend._id, friend.username);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition-colors text-left disabled:opacity-50 cursor-pointer"
                                >
                                  <Ban className="size-3.5 shrink-0" />
                                  <span>Block Player</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Requests */}
          {activeTab === "requests" && (
            <div
              className="space-y-3.5 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 scrollbar-thin"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {/* Incoming Requests */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Incoming ({incomingRequests?.length ?? 0})
                </span>
                {!incomingRequests || incomingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center rounded-xl border border-dashed border-border/60 bg-muted/5">
                    No pending friend requests
                  </p>
                ) : (
                  incomingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8 ring-1 ring-emerald-500/40 shrink-0">
                          <AvatarImage src={req.avatarUrl} alt={req.username} />
                          <AvatarFallback className="text-xs font-bold">
                            {initials(req.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {req.username}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {formatRating(req.rating)} ELO
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="xs"
                          disabled={isSubmitting}
                          onClick={() => handleRespond(req.friendshipId, true, req.username)}
                          className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 rounded-xl shadow-xs"
                        >
                          <Check className="size-3" /> Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={isSubmitting}
                          onClick={() => handleRespond(req.friendshipId, false, req.username)}
                          className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 rounded-xl"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Outgoing Requests */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Sent Requests ({outgoingRequests?.length ?? 0})
                </span>
                {!outgoingRequests || outgoingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No outgoing requests
                  </p>
                ) : (
                  outgoingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-2 rounded-2xl border border-border/50 bg-card shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-7 shrink-0">
                          <AvatarImage src={req.avatarUrl} alt={req.username} />
                          <AvatarFallback className="text-[10px] font-bold">
                            {initials(req.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {req.username}
                          </p>
                          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-2.5" /> Pending approval
                          </p>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => handleCancelRequest(req.friendshipId)}
                        className="h-6.5 text-[10px] font-semibold text-muted-foreground hover:text-destructive rounded-lg px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Add Friend & Search */}
          {activeTab === "add" && (
            <div className="flex flex-col flex-1 min-h-0 space-y-2.5">
              <div className="relative shrink-0">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player username..."
                  className="w-full h-9 rounded-xl border border-input bg-background pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div
                className="space-y-1.5 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 scrollbar-thin"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {searchQuery.trim().length < 2 ? (
                  <div className="text-center py-7 space-y-1">
                    <p className="text-xs font-medium text-foreground">Find Castle Players</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Type at least 2 characters to search for players to add to your circle.
                    </p>
                  </div>
                ) : !searchResults || searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-7">
                    No players found matching &quot;{searchQuery}&quot;.
                  </p>
                ) : (
                  searchResults.map((player: any) => {
                    const isBlocked = blocks?.some((b) => b._id === player._id);
                    const isAlreadyFriend = friends?.some((f) => f._id === player._id);
                    const isPendingOutgoing = outgoingRequests?.some((r) => r._id === player._id);
                    const isPendingIncoming = incomingRequests?.some((r) => r._id === player._id);

                    return (
                      <div
                        key={player._id}
                        className="flex items-center justify-between p-2 rounded-2xl border border-border/50 bg-card hover:bg-muted/30 transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-8 shrink-0">
                            <AvatarImage src={player.avatarUrl} alt={player.username} />
                            <AvatarFallback className="text-xs font-bold">
                              {initials(player.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {player.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {formatRating(player.ratingHuman)} ELO
                            </p>
                          </div>
                        </div>

                        {isBlocked ? (
                          <span className="text-[11px] font-bold text-destructive flex items-center gap-1 px-2.5 py-1 bg-destructive/10 rounded-xl border border-destructive/20">
                            <Ban className="size-3" /> Blocked
                          </span>
                        ) : isAlreadyFriend ? (
                          <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <UserCheck className="size-3" /> Friends
                          </span>
                        ) : isPendingOutgoing ? (
                          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 px-2.5 py-1 bg-muted rounded-xl">
                            <Clock className="size-3" /> Pending
                          </span>
                        ) : isPendingIncoming ? (
                          <Button
                            size="xs"
                            disabled={isSubmitting}
                            onClick={() => setActiveTab("requests")}
                            className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                          >
                            Respond
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            disabled={isSubmitting}
                            onClick={() => handleSendFriendRequest(player._id, player.username)}
                            className="h-7 text-[11px] font-bold gap-1 rounded-xl shadow-xs"
                          >
                            <UserPlus className="size-3" /> Add
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Blocked Players */}
          {activeTab === "blocked" && (
            <div
              className="space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 scrollbar-thin"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Blocked Players ({blocks?.length ?? 0})
              </span>
              {!blocks || blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-7">
                  You haven&apos;t blocked any players.
                </p>
              ) : (
                blocks.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center justify-between p-2.5 rounded-2xl border border-destructive/20 bg-destructive/5 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-7 shrink-0 opacity-60">
                        <AvatarImage src={b.avatarUrl} alt={b.username} />
                        <AvatarFallback className="text-xs font-bold">
                          {initials(b.username)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-bold text-foreground truncate">{b.username}</p>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => handleUnblockPlayer(b._id, b.username)}
                      className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-xl"
                    >
                      Unblock
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
