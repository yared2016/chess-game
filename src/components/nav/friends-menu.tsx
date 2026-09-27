"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";
import { toast } from "sonner";

export function FriendsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add" | "blocked">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Queries
  const friends = useQuery(api.friends.myFriends, open ? {} : "skip");
  const incomingRequests = useQuery(api.friends.myIncomingRequests, {});
  const outgoingRequests = useQuery(api.friends.myOutgoingRequests, open ? {} : "skip");
  const blocks = useQuery(api.friends.myBlocks, open ? {} : "skip");

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

  // Close menu on click outside
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

  // Actions
  const handleSendFriendRequest = async (toPlayerId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await sendRequest({ toPlayerId });
      toast.success(`Friend request sent to ${username}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send friend request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (friendshipId: any, accept: boolean, username: string) => {
    try {
      await respond({ friendshipId, accept });
      if (accept) {
        toast.success(`You and ${username} are now friends!`);
      } else {
        toast.info(`Declined friend request from ${username}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to respond to request");
    }
  };

  const handleCancelRequest = async (friendshipId: any) => {
    try {
      await cancelRequest({ friendshipId });
      toast.info("Friend request cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel request");
    }
  };

  const handleRemoveFriend = async (friendshipId: any, username: string) => {
    try {
      await removeFriend({ friendshipId });
      toast.info(`Removed ${username} from friends`);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove friend");
    }
  };

  const handleBlockPlayer = async (blockedId: any, username: string) => {
    try {
      await blockPlayer({ blockedId });
      toast.info(`Blocked ${username}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to block player");
    }
  };

  const handleUnblockPlayer = async (blockedId: any, username: string) => {
    try {
      await unblockPlayer({ blockedId });
      toast.success(`Unblocked ${username}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to unblock player");
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
        <div className="fixed left-1/2 -translate-x-1/2 top-16 w-[calc(100vw-1.5rem)] max-w-sm sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full sm:mt-2 sm:w-[26rem] z-50 rounded-3xl border border-border/80 bg-card/98 backdrop-blur-xl shadow-2xl p-4 sm:p-5 animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-border/60">
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
              onClick={() => setOpen(false)}
              className="size-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label="Close friends menu"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 my-3 p-1 rounded-2xl bg-muted/50 border border-border/60 text-xs">
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
            <div className="space-y-2 max-h-76 overflow-y-auto pr-1">
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
                friends.map((friend) => (
                  <div
                    key={friend._id}
                    className="flex items-center justify-between p-2.5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:bg-muted/20 transition-all shadow-xs"
                  >
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

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-7 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
                              aria-label="Friend options"
                            />
                          }
                        >
                          <MoreVertical className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom" className="w-40 p-1.5 z-50 rounded-xl shadow-xl">
                          <DropdownMenuItem
                            onClick={() => {
                              setOpen(false);
                              router.push(`/profile/${encodeURIComponent(friend.username)}`);
                            }}
                            className="cursor-pointer text-xs font-medium py-1.5"
                          >
                            <User className="size-3.5 mr-2 text-primary" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChallenge(friend.username)}
                            className="cursor-pointer text-xs font-medium py-1.5"
                          >
                            <Swords className="size-3.5 mr-2 text-emerald-500" />
                            Challenge
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleRemoveFriend(friend.friendshipId, friend.username)}
                            className="cursor-pointer text-xs font-medium text-amber-500 hover:text-amber-600 py-1.5"
                          >
                            <UserX className="size-3.5 mr-2" />
                            Unfriend
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleBlockPlayer(friend._id, friend.username)}
                            className="cursor-pointer text-xs font-medium py-1.5"
                          >
                            <Ban className="size-3.5 mr-2" />
                            Block Player
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Requests */}
          {activeTab === "requests" && (
            <div className="space-y-3.5 max-h-76 overflow-y-auto pr-1">
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
                          onClick={() => handleRespond(req.friendshipId, true, req.username)}
                          className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 rounded-xl shadow-xs"
                        >
                          <Check className="size-3" /> Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
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
            <div className="space-y-3">
              <div className="relative">
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

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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

                        {isAlreadyFriend ? (
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
            <div className="space-y-2 max-h-76 overflow-y-auto pr-1">
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
