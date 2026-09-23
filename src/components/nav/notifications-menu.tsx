"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
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
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "challenge_received":
      return <Swords className="size-4 text-primary" />;
    case "challenge_accepted":
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "challenge_declined":
      return <XCircle className="size-4 text-amber-500" />;
    case "deposit_submitted":
      return <ArrowDownLeft className="size-4 text-primary" />;
    case "deposit_approved":
      return <ArrowDownLeft className="size-4 text-emerald-500" />;
    case "deposit_rejected":
      return <XCircle className="size-4 text-destructive" />;
    case "withdrawal_submitted":
      return <ArrowUpRight className="size-4 text-primary" />;
    case "withdrawal_completed":
      return <ArrowUpRight className="size-4 text-emerald-500" />;
    case "withdrawal_rejected":
      return <XCircle className="size-4 text-destructive" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
}

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const notifications = useQuery((api as any).notifications?.getMyNotifications, {});
  const unreadCount = useQuery((api as any).notifications?.getUnreadCount, {}) ?? 0;
  const markAsRead = useMutation((api as any).notifications?.markAsRead);
  const markAllAsRead = useMutation((api as any).notifications?.markAllAsRead);
  const clearAllNotifications = useMutation((api as any).notifications?.clearAll);
  const deleteNotification = useMutation((api as any).notifications?.deleteNotification);

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

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      await markAsRead({ notificationId: notif._id }).catch(() => {});
    }
    setOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead({});
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications({});
    } catch {}
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    try {
      await deleteNotification({ notificationId: id });
    } catch {}
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        aria-label="View notifications"
        className="relative shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-xs animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 w-[calc(100vw-1.5rem)] max-w-sm sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full sm:mt-2 sm:w-96 z-50 rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 px-2 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="size-3" />
                  <span>Clear all</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40 py-1">
            {!notifications || notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Bell className="mx-auto size-7 mb-2 opacity-30" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "group relative flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors",
                    n.read
                      ? "hover:bg-muted/40 opacity-80"
                      : "bg-primary/5 hover:bg-primary/10 font-medium"
                  )}
                >
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background border border-border/70 shadow-xs">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5 pr-5">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!n.read && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteOne(e, n._id)}
                      className="p-1 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
