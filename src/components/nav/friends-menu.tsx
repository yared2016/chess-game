"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Swords,
  Search,
  Check,
  X,
  Clock,
  Ban,
  Shield,
  MoreVertical,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";
import { toast } from "sonner";

export function FriendsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add" | "blocked">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdownFriendId, setActiveDropdownFriendId] = useState<string | null>(null);
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
        setActiveDropdownFriendId(null);
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
      setActiveDropdownFriendId(null);
      toast.info(`Removed ${username} from friends`);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove friend");
    }
  };

  const handleBlockPlayer = async (blockedId: any, username: string) => {
    try {
      await blockPlayer({ blockedId });
      setActiveDropdownFriendId(null);
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
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        aria-label="Friends & Social"
        className="relative shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Users className="size-4.5" />
        {pendingIncomingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-75">
            {pendingIncomingCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-4 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">Friends & Social</h3>
                <p className="text-[10px] text-muted-foreground">
                  {friends?.length ?? 0} {friends?.length === 1 ? "friend" : "friends"} connected
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 my-3 p-1 rounded-2xl bg-muted/40 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("friends")}
              className={cn(
                "flex-1 py-1.5 rounded-xl font-bold transition-all text-center",
                activeTab === "friends"
                  ? "bg-background text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Friends ({friends?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={cn(
                "flex-1 py-1.5 rounded-xl font-bold transition-all text-center relative",
                activeTab === "requests"
                  ? "bg-background text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Requests
              {pendingIncomingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("add")}
              className={cn(
                "flex-1 py-1.5 rounded-xl font-bold transition-all text-center",
                activeTab === "add"
                  ? "bg-background text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Add Friend
            </button>
            {blocks && blocks.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("blocked")}
                className={cn(
                  "py-1.5 px-2 rounded-xl font-bold transition-all text-center",
                  activeTab === "blocked"
                    ? "bg-background text-foreground shadow-xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Blocked Players"
              >
                <Ban className="size-3.5" />
              </button>
            )}
          </div>

          {/* Tab 1: Friends List */}
          {activeTab === "friends" && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {!friends || friends.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="size-10 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Users className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">No friends yet</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Connect with players to easily challenge them to casual or staked matches anytime.
                  </p>
                  <Button
                    size="xs"
                    onClick={() => setActiveTab("add")}
                    className="mt-2 text-xs font-bold gap-1"
                  >
                    <UserPlus className="size-3.5" /> Find Players
                  </Button>
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend._id}
                    className="flex items-center justify-between p-2 rounded-2xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <Link
                      href={`/profile/${encodeURIComponent(friend.username)}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
                    >
                      <Avatar className="size-8 ring-1 ring-border shrink-0">
                        <AvatarImage src={friend.avatarUrl} alt={friend.username} />
                        <AvatarFallback className="text-xs font-bold">
                          {initials(friend.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {friend.username}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatRating(friend.ratingHuman ?? friend.rating)} ELO
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0 relative">
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => handleChallenge(friend.username)}
                        className="h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="Challenge to match"
                      >
                        <Swords className="size-3" />
                        Play
                      </Button>

                      {/* Dropdown Options */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDropdownFriendId(
                            activeDropdownFriendId === friend._id ? null : friend._id
                          )
                        }
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>

                      {activeDropdownFriendId === friend._id && (
                        <div className="absolute right-0 top-8 w-36 rounded-xl border border-border bg-card p-1 shadow-lg z-20 space-y-0.5 animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(friend.friendshipId, friend.username)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted rounded-lg transition-colors text-left"
                          >
                            <UserX className="size-3 text-amber-500" />
                            Unfriend
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBlockPlayer(friend._id, friend.username)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-left"
                          >
                            <Ban className="size-3" />
                            Block Player
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Requests */}
          {activeTab === "requests" && (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {/* Incoming Requests */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Incoming ({incomingRequests?.length ?? 0})
                </span>
                {!incomingRequests || incomingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No pending friend requests
                  </p>
                ) : (
                  incomingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-7 ring-1 ring-emerald-500/40 shrink-0">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="xs"
                          onClick={() => handleRespond(req.friendshipId, true, req.username)}
                          className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-0.5 px-2"
                        >
                          <Check className="size-3" /> Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleRespond(req.friendshipId, false, req.username)}
                          className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Outgoing Requests */}
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Sent Requests ({outgoingRequests?.length ?? 0})
                </span>
                {!outgoingRequests || outgoingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1 text-center">
                    No outgoing requests
                  </p>
                ) : (
                  outgoingRequests.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-2 rounded-2xl border border-border/50 bg-card"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-6 shrink-0">
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
                        className="h-6 text-[10px] font-semibold text-muted-foreground hover:text-destructive px-2"
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
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player username or email..."
                  className="w-full h-9 rounded-xl border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {searchQuery.trim().length < 2 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Type at least 2 characters to search for registered players.
                  </p>
                ) : !searchResults || searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
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
                        className="flex items-center justify-between p-2 rounded-2xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
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
                          <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1 px-2 py-1">
                            <UserCheck className="size-3" /> Friends
                          </span>
                        ) : isPendingOutgoing ? (
                          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted rounded-lg">
                            <Clock className="size-3" /> Pending
                          </span>
                        ) : isPendingIncoming ? (
                          <Button
                            size="xs"
                            onClick={() => setActiveTab("requests")}
                            className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Review Request
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            disabled={isSubmitting}
                            onClick={() => handleSendFriendRequest(player._id, player.username)}
                            className="h-7 text-[11px] font-bold gap-1"
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
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Blocked Players ({blocks?.length ?? 0})
              </span>
              {!blocks || blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  You haven&apos;t blocked any players.
                </p>
              ) : (
                blocks.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center justify-between p-2 rounded-2xl border border-destructive/20 bg-destructive/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
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
                      className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
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
