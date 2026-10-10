"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
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
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Sparkles,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FriendActionSheet, type FriendActionTarget } from "@/components/friends/friend-action-sheet";
import { cn, initials } from "@/lib/ui";
import { formatRating } from "@/lib/format";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";

export function FriendsHub() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();

  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add" | "blocked">("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [activeActionFriend, setActiveActionFriend] = useState<FriendActionTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convex queries
  const friends = useQuery(api.friends.myFriends, isAuthenticated ? {} : "skip");
  const incomingRequests = useQuery(api.friends.myIncomingRequests, isAuthenticated ? {} : "skip");
  const outgoingRequests = useQuery(api.friends.myOutgoingRequests, isAuthenticated ? {} : "skip");
  const blocks = useQuery(api.friends.myBlocks, isAuthenticated ? {} : "skip");

  // Search results for adding friends
  const searchResults = useQuery(
    (api as any).challenges?.searchPlayers,
    activeTab === "add" && addSearchQuery.trim().length >= 2
      ? { query: addSearchQuery.trim() }
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
  const friendsCount = friends?.length ?? 0;
  const outgoingCount = outgoingRequests?.length ?? 0;
  const blockedCount = blocks?.length ?? 0;

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    if (!friendSearch.trim()) return friends;
    const q = friendSearch.toLowerCase().trim();
    return friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, friendSearch]);

  const handleAccept = async (friendshipId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await respond({ friendshipId, accept: true });
      toast.success(`You and ${username} are now friends!`);
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to accept request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (friendshipId: any) => {
    try {
      setIsSubmitting(true);
      await respond({ friendshipId, accept: false });
      toast.info("Friend request declined");
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to decline request"));
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
      toast.info(`Removed ${username} from friends`);
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to remove friend"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlockPlayer = async (blockedId: any, username: string) => {
    try {
      setIsSubmitting(true);
      await blockPlayer({ blockedId });
      toast.info(`Blocked ${username}`);
    } catch (err: any) {
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
      toast.error(describeConvexError(err, "Failed to unblock player"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendFriendRequest = async (targetId: any, targetUsername: string) => {
    try {
      setIsSubmitting(true);
      await sendRequest({ toPlayerId: targetId });
      toast.success(`Friend request sent to ${targetUsername}!`);
    } catch (err: any) {
      toast.error(describeConvexError(err, "Could not send friend request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChallenge = (username: string) => {
    router.push(`/play?mode=direct&challenge=${encodeURIComponent(username)}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header with Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Friends & Social</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect, challenge friends, and grow your chess network
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-xs text-xs font-bold text-foreground">
            <Users className="size-3.5 text-primary" />
            <span>{friendsCount} Friends</span>
          </div>
          {pendingIncomingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/30 shadow-xs text-xs font-black text-primary animate-pulse">
              <UserPlus className="size-3.5" />
              <span>{pendingIncomingCount} Incoming</span>
            </div>
          )}
          <Link
            href="/players"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
          >
            <Search className="size-3.5" />
            <span>Player Directory</span>
          </Link>
        </div>
      </div>

      {/* Interactive Tabs Bar (Fitted 4-column responsive grid, zero horizontal overflow) */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted/50 border border-border/70 text-xs sm:text-sm w-full">
        <button
          type="button"
          onClick={() => setActiveTab("friends")}
          className={cn(
            "flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 rounded-xl font-bold transition-all min-w-0 text-center",
            activeTab === "friends"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Users className="size-3.5 sm:size-4 shrink-0" />
          <span className="truncate">Friends</span>
          <span className="text-[10px] sm:text-[11px] font-mono opacity-70 shrink-0">({friendsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={cn(
            "relative flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 rounded-xl font-bold transition-all min-w-0 text-center",
            activeTab === "requests"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <UserPlus className="size-3.5 sm:size-4 shrink-0" />
          <span className="truncate">Requests</span>
          {pendingIncomingCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse shrink-0">
              {pendingIncomingCount}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-mono opacity-70 shrink-0">
              ({outgoingCount})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("add")}
          className={cn(
            "flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 rounded-xl font-bold transition-all min-w-0 text-center",
            activeTab === "add"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Search className="size-3.5 sm:size-4 shrink-0" />
          <span className="hidden sm:inline">Find Players</span>
          <span className="sm:hidden truncate">Add</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blocked")}
          className={cn(
            "flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 rounded-xl font-bold transition-all min-w-0 text-center",
            activeTab === "blocked"
              ? "bg-card text-destructive shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-destructive hover:bg-muted/40"
          )}
        >
          <Ban className="size-3.5 sm:size-4 shrink-0" />
          <span className="truncate">Blocked</span>
          {blockedCount > 0 && (
            <span className="text-[10px] sm:text-[11px] font-mono opacity-70 shrink-0">({blockedCount})</span>
          )}
        </button>
      </div>

      {/* TAB 1: FRIENDS LIST */}
      {activeTab === "friends" && (
        <div className="space-y-4">
          {/* Search bar inside Friends tab */}
          {friends && friends.length > 0 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search friends by username..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-card border-border/80 text-sm"
              />
            </div>
          )}

          {!friends ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/90 bg-card/40 p-10 text-center space-y-4">
              <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-7 opacity-80" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-foreground">No friends yet</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  You haven&apos;t added any friends yet. Search for players to challenge and add to your network!
                </p>
              </div>
              <Button onClick={() => setActiveTab("add")} className="rounded-xl font-bold gap-2">
                <UserPlus className="size-4" />
                Find & Add Players
              </Button>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">No friends match &quot;{friendSearch}&quot;</p>
              <Button variant="ghost" size="sm" onClick={() => setFriendSearch("")}>
                Clear filter
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredFriends.map((friend) => (
                <div
                  key={friend._id}
                  className="group relative flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <Link
                    href={`/profile/${encodeURIComponent(friend.username)}`}
                    className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                  >
                    <div className="relative">
                      <Avatar className="size-11 ring-1 ring-border group-hover:ring-primary/40 transition-all">
                        <AvatarImage src={friend.avatarUrl} alt={friend.username} />
                        <AvatarFallback className="text-xs font-black">{initials(friend.username)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {friend.username}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {friend.rating ? formatRating(friend.rating) : "Unrated"} ELO
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleChallenge(friend.username)}
                      className="rounded-xl gap-1.5 font-bold h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                    >
                      <Swords className="size-3.5" />
                      <span>Play</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveActionFriend(friend);
                      }}
                      className={cn(
                        "size-9 rounded-xl transition-colors",
                        activeActionFriend?._id === friend._id
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                      aria-label={`Options for ${friend.username}`}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REQUESTS (INCOMING & OUTGOING) */}
      {activeTab === "requests" && (
        <div className="space-y-8">
          {/* Incoming Requests Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Incoming Requests ({pendingIncomingCount})
              </h2>
            </div>

            {!incomingRequests ? (
              <div className="h-24 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
            ) : incomingRequests.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-center text-xs sm:text-sm text-muted-foreground">
                No pending incoming requests.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs"
                  >
                    <Link
                      href={`/profile/${encodeURIComponent(req.username)}`}
                      className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                    >
                      <Avatar className="size-10 ring-1 ring-border">
                        <AvatarImage src={req.avatarUrl} alt={req.username} />
                        <AvatarFallback className="text-xs font-bold">{initials(req.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-foreground truncate">{req.username}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {req.rating ? formatRating(req.rating) : "Unrated"} ELO
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => handleAccept(req.friendshipId, req.username)}
                        className="rounded-xl gap-1 font-bold h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Check className="size-3.5" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => handleDecline(req.friendshipId)}
                        className="rounded-xl font-bold h-9 px-2.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Sent Requests ({outgoingCount})
              </h2>
            </div>

            {!outgoingRequests ? (
              <div className="h-24 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
            ) : outgoingRequests.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-center text-xs sm:text-sm text-muted-foreground">
                No outgoing requests waiting.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs opacity-90"
                  >
                    <Link
                      href={`/profile/${encodeURIComponent(req.username)}`}
                      className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                    >
                      <Avatar className="size-10 ring-1 ring-border">
                        <AvatarImage src={req.avatarUrl} alt={req.username} />
                        <AvatarFallback className="text-xs font-bold">{initials(req.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-foreground truncate">{req.username}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>Pending response</span>
                        </div>
                      </div>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isSubmitting}
                      onClick={() => handleCancelRequest(req.friendshipId)}
                      className="rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIND & ADD PLAYERS */}
      {activeTab === "add" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">Find Players on Abay Chess</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Search by username to send instant friend requests or challenge players.
            </p>
            <div className="relative max-w-lg pt-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Type at least 2 letters of username..."
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-2xl bg-card border-border/80 text-sm"
              />
            </div>
          </div>

          {addSearchQuery.trim().length < 2 ? (
            <div className="rounded-3xl border border-border/70 bg-card/40 p-8 text-center space-y-3">
              <div className="size-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Search className="size-6 opacity-70" />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Start typing above to search from thousands of Abay Chess players across university campuses and the globe.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/players")}
                  className="rounded-xl text-xs font-bold gap-2"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Browse Full Player Directory
                </Button>
              </div>
            </div>
          ) : !searchResults ? (
            <div className="py-12 flex justify-center items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Searching players...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">No players found matching &quot;{addSearchQuery}&quot;</p>
              <p className="text-xs text-muted-foreground">Check the spelling or try searching in the full player directory.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map((player: any) => (
                <div
                  key={player._id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs"
                >
                  <Link
                    href={`/profile/${encodeURIComponent(player.username)}`}
                    className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                  >
                    <Avatar className="size-11 ring-1 ring-border">
                      <AvatarImage src={player.avatarUrl} alt={player.username} />
                      <AvatarFallback className="text-xs font-black">{initials(player.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-foreground truncate">{player.username}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {player.rating ? formatRating(player.rating) : "Unrated"} ELO
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => handleSendFriendRequest(player._id, player.username)}
                      className="rounded-xl gap-1 font-bold h-9 px-3 text-xs"
                    >
                      <UserPlus className="size-3.5 text-primary" />
                      <span>Add</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleChallenge(player.username)}
                      className="rounded-xl gap-1 font-bold h-9 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Challenge to match"
                    >
                      <Swords className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BLOCKED PLAYERS */}
      {activeTab === "blocked" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Blocked Players</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Blocked players cannot challenge you, send friend requests, or message you.
            </p>
          </div>

          {!blocks ? (
            <div className="h-24 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
          ) : blocks.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-xs sm:text-sm text-muted-foreground">
              You haven&apos;t blocked any players.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {blocks.map((block) => (
                <div
                  key={block.blockId}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <Avatar className="size-10 ring-1 ring-border opacity-70">
                      <AvatarImage src={block.avatarUrl} alt={block.username} />
                      <AvatarFallback className="text-xs font-bold">{initials(block.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{block.username}</p>
                      <p className="text-[11px] text-muted-foreground">Blocked</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => handleUnblockPlayer(block._id, block.username)}
                    className="rounded-xl text-xs font-bold h-8 px-3"
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Universal Action Sheet / Modal */}
      <FriendActionSheet
        friend={activeActionFriend}
        open={Boolean(activeActionFriend)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setActiveActionFriend(null);
        }}
        onChallenge={handleChallenge}
        onRemoveFriend={handleRemoveFriend}
        onBlockPlayer={handleBlockPlayer}
      />
    </div>
  );
}
