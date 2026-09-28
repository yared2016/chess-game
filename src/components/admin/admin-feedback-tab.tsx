"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  MessageSquare,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Swords,
  Users,
  Trophy,
  Wallet,
  UserCheck,
  Layout,
  Paperclip,
  Eye,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackDetailModal, FeedbackItem } from "./feedback-detail-modal";
import { cn } from "@/lib/ui";

type FeedbackCategory =
  | "chess_game"
  | "matchmaking"
  | "tournaments"
  | "wallet_payments"
  | "account_profile"
  | "website_app"
  | "feature_request"
  | "report_problem"
  | "general_feedback";

const CATEGORY_MAP: Record<
  FeedbackCategory,
  { label: string; icon: typeof Swords; color: string }
> = {
  chess_game: { label: "Chess Game", icon: Swords, color: "text-amber-500" },
  matchmaking: { label: "Matchmaking", icon: Users, color: "text-blue-500" },
  tournaments: { label: "Tournaments", icon: Trophy, color: "text-indigo-500" },
  wallet_payments: { label: "Wallet & Payments", icon: Wallet, color: "text-emerald-500" },
  account_profile: { label: "Account & Profile", icon: UserCheck, color: "text-purple-500" },
  website_app: { label: "App & Performance", icon: Layout, color: "text-cyan-500" },
  feature_request: { label: "Feature Request", icon: Lightbulb, color: "text-yellow-400" },
  report_problem: { label: "Report a Bug", icon: AlertCircle, color: "text-rose-500" },
  general_feedback: { label: "General Feedback", icon: MessageSquare, color: "text-primary" },
};

export function AdminFeedbackTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedTicket, setSelectedTicket] = useState<FeedbackItem | null>(null);

  const stats = useQuery(api.feedback.adminGetStats, {});
  const feedbackList = useQuery(api.feedback.adminList, {
    search: search.trim() || undefined,
    status: statusFilter !== "ALL" ? (statusFilter as "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED") : undefined,
    category: categoryFilter !== "ALL" ? (categoryFilter as FeedbackCategory) : undefined,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      {/* Detail Inspection Modal */}
      {selectedTicket && (
        <FeedbackDetailModal
          feedback={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {/* High-Impact Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Feedback */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Total Tickets</span>
            <MessageSquare className="size-4 text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            {stats?.total ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground">All time submissions</p>
        </div>

        {/* New / Action Required */}
        <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-400 uppercase tracking-wider">
            <span>New Tickets</span>
            <Clock className="size-4 text-blue-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-400">
            {stats?.newCount ?? 0}
          </p>
          <p className="text-[11px] text-blue-400/80">Pending staff review</p>
        </div>

        {/* In Review */}
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <span>In Review</span>
            <AlertCircle className="size-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">
            {stats?.inReviewCount ?? 0}
          </p>
          <p className="text-[11px] text-amber-400/80">Actively being addressed</p>
        </div>

        {/* Resolved */}
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Resolved</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">
            {stats?.resolvedCount ?? 0}
          </p>
          <p className="text-[11px] text-emerald-400/80">Completed tickets</p>
        </div>

        {/* Feature Requests */}
        <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-400 uppercase tracking-wider">
            <span>Feature Ideas</span>
            <Lightbulb className="size-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-400">
            {stats?.featureRequestsCount ?? 0}
          </p>
          <p className="text-[11px] text-purple-400/80">Player suggestions</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by player, email, text, game ID..."
            className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/80"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Categories</option>
            <option value="chess_game">Chess Game</option>
            <option value="matchmaking">Matchmaking</option>
            <option value="tournaments">Tournaments</option>
            <option value="wallet_payments">Wallet & Payments</option>
            <option value="account_profile">Account & Profile</option>
            <option value="website_app">Performance & UI</option>
            <option value="feature_request">Feature Request</option>
            <option value="report_problem">Bug Report</option>
            <option value="general_feedback">General Feedback</option>
          </select>
        </div>
      </div>

      {/* Feedback List Table / Cards */}
      {feedbackList === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border/70 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : feedbackList.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-border/80 bg-card/40 space-y-3">
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <MessageSquare className="size-6" />
          </div>
          <p className="text-sm font-bold text-foreground">No feedback tickets found</p>
          <p className="text-xs text-muted-foreground">
            {search || statusFilter !== "ALL" || categoryFilter !== "ALL"
              ? "Try adjusting your search criteria or clearing filters."
              : "No feedback submissions in the system yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <span>Showing {feedbackList.length} Ticket{feedbackList.length === 1 ? "" : "s"}</span>
          </div>

          <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-card/80 overflow-hidden shadow-sm">
            {feedbackList.map((item) => {
              const catInfo = CATEGORY_MAP[item.category] ?? {
                label: item.category,
                icon: MessageSquare,
                color: "text-primary",
              };
              const CatIcon = catInfo.icon;
              const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedTicket(item)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  {/* Left: Player + Category + Message preview */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar className="size-9 border border-border/80 shrink-0 mt-0.5">
                      <AvatarImage src={item.userAvatarUrl} />
                      <AvatarFallback className="font-bold text-xs">
                        {item.userName ? item.userName.slice(0, 2).toUpperCase() : "PL"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{item.userName}</span>
                        <Badge variant="outline" className="text-[10px] font-semibold border-primary/20 text-primary py-0">
                          <CatIcon className={cn("size-2.5 mr-1", catInfo.color)} />
                          {catInfo.label}
                        </Badge>
                        {item.attachments && item.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium">
                            <Paperclip className="size-2.5 text-primary" />
                            {item.attachments.length}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-1 leading-snug">
                        {item.description}
                      </p>

                      {/* Associated context tags */}
                      {(item.gameId || item.opponentUsername) && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {item.gameId && <span>Game: #{item.gameId.slice(0, 8)}</span>}
                          {item.opponentUsername && <span>vs @{item.opponentUsername}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Status + Email + Date + Inspect Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                    <div className="flex items-center gap-2">
                      {/* Status */}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-bold capitalize",
                          item.status === "NEW" && "border-blue-500/40 text-blue-400 bg-blue-500/10",
                          item.status === "IN_REVIEW" && "border-amber-500/40 text-amber-400 bg-amber-500/10",
                          item.status === "RESOLVED" && "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
                          item.status === "CLOSED" && "border-slate-500/40 text-slate-400 bg-slate-500/10"
                        )}
                      >
                        {item.status.replace(/_/g, " ")}
                      </Badge>

                      {/* Email Status Indicator */}
                      <span
                        title={`Confirmation Email: ${item.emailStatus}`}
                        className={cn(
                          "size-2 rounded-full",
                          item.emailStatus === "SENT" && "bg-emerald-500",
                          item.emailStatus === "FAILED" && "bg-rose-500 animate-pulse",
                          item.emailStatus === "NOT_SENT" && "bg-slate-500"
                        )}
                      />
                    </div>

                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formattedDate}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(item);
                      }}
                      className="h-8 px-2.5 text-xs font-bold gap-1 rounded-xl"
                    >
                      <Eye className="size-3.5" />
                      <span>Inspect</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
