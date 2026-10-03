"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  XCircle,
  Swords,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Sparkles,
  ExternalLink,
  Trash2,
  X,
  Wallet,
  Users,
  Info,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/ui";
import { toast } from "sonner";

function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeStr}`;
  }

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
}

function getNotificationVisuals(type: string) {
  switch (type) {
    case "challenge_received":
      return {
        icon: Swords,
        color: "text-primary",
        bg: "bg-primary/10 border-primary/25",
        badge: "Match Challenge",
      };
    case "challenge_accepted":
      return {
        icon: CheckCircle2,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10 border-emerald-500/25",
        badge: "Challenge Accepted",
      };
    case "challenge_declined":
      return {
        icon: XCircle,
        color: "text-amber-500",
        bg: "bg-amber-500/10 border-amber-500/25",
        badge: "Challenge Declined",
      };
    case "deposit_submitted":
    case "deposit_approved":
    case "chapa_payment_verified":
      return {
        icon: ArrowDownLeft,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10 border-emerald-500/25",
        badge: "Deposit / Balance",
      };
    case "deposit_rejected":
    case "chapa_payment_failed":
      return {
        icon: XCircle,
        color: "text-rose-500",
        bg: "bg-rose-500/10 border-rose-500/25",
        badge: "Deposit Failed",
      };
    case "withdrawal_submitted":
    case "withdrawal_completed":
      return {
        icon: ArrowUpRight,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10 border-emerald-500/25",
        badge: "Withdrawal",
      };
    case "withdrawal_rejected":
      return {
        icon: XCircle,
        color: "text-rose-500",
        bg: "bg-rose-500/10 border-rose-500/25",
        badge: "Withdrawal Rejected",
      };
    case "friend_request":
    case "friend_accepted":
      return {
        icon: Users,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/25",
        badge: "Social",
      };
    default:
      return {
        icon: Bell,
        color: "text-primary",
        bg: "bg-primary/10 border-primary/25",
        badge: "Notification",
      };
  }
}

export function NotificationsView() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();

  const [filter, setFilter] = useState<"all" | "unread" | "challenges" | "wallet" | "social">("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Queries
  const notifications = useQuery(
    (api as any).notifications?.getMyNotifications,
    isAuthenticated ? {} : "skip"
  );
  const unreadCount =
    useQuery(
      (api as any).notifications?.getUnreadCount,
      isAuthenticated ? {} : "skip"
    ) ?? 0;

  // Mutations
  const markAsRead = useMutation((api as any).notifications?.markAsRead);
  const markAllAsRead = useMutation((api as any).notifications?.markAllAsRead);
  const clearAllNotifications = useMutation((api as any).notifications?.clearAll);
  const deleteNotification = useMutation((api as any).notifications?.deleteNotification);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    switch (filter) {
      case "unread":
        return notifications.filter((n: any) => !n.read);
      case "challenges":
        return notifications.filter((n: any) =>
          n.type?.startsWith("challenge_") || n.type === "rematch"
        );
      case "wallet":
        return notifications.filter(
          (n: any) =>
            n.type?.startsWith("deposit_") ||
            n.type?.startsWith("withdrawal_") ||
            n.type?.startsWith("chapa_")
        );
      case "social":
        return notifications.filter((n: any) => n.type?.startsWith("friend_"));
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead({});
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications({});
      setClearDialogOpen(false);
      toast.info("All notifications cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsRead({ notificationId: notif._id }).catch(() => {});
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleToggleRead = async (e: React.MouseEvent, notif: any) => {
    e.stopPropagation();
    if (!notif.read) {
      await markAsRead({ notificationId: notif._id }).catch(() => {});
      toast.success("Marked as read");
    }
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    try {
      await deleteNotification({ notificationId: id });
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Bell className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-black text-primary animate-pulse">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Stay updated on game challenges, rematches, wallet updates, and friends
              </p>
            </div>
          </div>
        </div>

        {/* Global Batch Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="rounded-xl text-xs font-bold gap-1.5 h-9"
            >
              <CheckCheck className="size-4 text-primary" />
              <span>Mark All Read</span>
            </Button>
          )}

          {notifications && notifications.length > 0 && (
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 h-9"
                  />
                }
              >
                <Trash2 className="size-3.5" />
                <span>Clear All</span>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently dismiss all notifications from your history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleClearAll}
                    className="rounded-xl font-bold"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/70 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
            filter === "all"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>All</span>
          {notifications && (
            <span className="text-[11px] font-mono opacity-70">({notifications.length})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
            filter === "unread"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-black text-primary">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilter("challenges")}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
            filter === "challenges"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Swords className="size-3.5 text-primary" />
          <span>Challenges</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("wallet")}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
            filter === "wallet"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wallet className="size-3.5 text-emerald-500" />
          <span>Wallet</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("social")}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0",
            filter === "social"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-3.5 text-indigo-400" />
          <span>Friends</span>
        </button>
      </div>

      {/* Notifications List */}
      {!notifications ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-card/60 animate-pulse border border-border/60" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/90 bg-card/40 p-12 text-center space-y-4">
          <div className="size-16 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
            <Bell className="size-8 opacity-70" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-foreground">No notifications yet</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              When someone challenges you to a game, sends a friend request, or your deposits clear, notifications will appear here.
            </p>
          </div>
          <Button onClick={() => router.push("/play")} className="rounded-xl font-bold gap-2">
            <Swords className="size-4" />
            Play a Chess Match
          </Button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No notifications in this filter</p>
          <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
            View all notifications
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif: any) => {
            const visuals = getNotificationVisuals(notif.type);
            const Icon = visuals.icon;

            return (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "group relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-start gap-4 shadow-xs",
                  notif.read
                    ? "bg-card/70 border-border/80 hover:border-primary/40 hover:bg-card"
                    : "bg-card border-primary/40 shadow-sm ring-1 ring-primary/20 hover:border-primary"
                )}
              >
                {/* Visual Icon Badge */}
                <div
                  className={cn(
                    "size-10 sm:size-11 rounded-2xl flex items-center justify-center border shrink-0",
                    visuals.bg,
                    visuals.color
                  )}
                >
                  <Icon className="size-5" />
                </div>

                {/* Content Body (Full text, not truncated!) */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-black text-foreground">
                        {notif.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground uppercase tracking-wider border border-border/60">
                        {visuals.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <Clock className="size-3" />
                      <span>{formatFullTime(notif.createdAt)}</span>
                    </div>
                  </div>

                  {/* Fully visible notification message */}
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed break-words whitespace-pre-line">
                    {notif.message}
                  </p>

                  {/* Optional Action Link if provided */}
                  {notif.link && (
                    <div className="pt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
                        <span>View Details</span>
                        <ExternalLink className="size-3" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons on the right */}
                <div className="flex sm:flex-col items-center gap-1 shrink-0 self-end sm:self-center">
                  {!notif.read && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(e, notif)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <Check className="size-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDeleteOne(e, notif._id)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
