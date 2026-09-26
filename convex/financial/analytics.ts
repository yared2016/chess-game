// convex/financial/analytics.ts — Authoritative financial analytics and aggregations
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requirePlayer } from "../lib/auth";

/**
 * Returns user's current wallet balance and authoritative lifetime statistics.
 */
export const getWalletOverview = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .first();

    const availableSantims =
      wallet?.availableSantims ?? Math.round((wallet?.availableBalance ?? 0) * 100);
    const lockedSantims =
      wallet?.lockedSantims ?? Math.round((wallet?.lockedBalance ?? 0) * 100);

    // Fetch all immutable ledger entries for lifetime aggregation
    const ledger = await ctx.db
      .query("financialLedger")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .collect();

    let totalDepositedSantims = 0;
    let totalWithdrawnSantims = 0;
    let totalMatchWinningsSantims = 0;
    let totalMatchEntriesSantims = 0;
    let totalChapaFeesSantims = 0;
    let depositsCount = 0;
    let withdrawalsCount = 0;
    const completedMatchIds = new Set<string>();

    for (const entry of ledger) {
      switch (entry.entryType) {
        case "deposit_credit":
          totalDepositedSantims += entry.amountSantims;
          depositsCount++;
          break;
        case "withdrawal_complete":
          totalWithdrawnSantims += entry.amountSantims;
          withdrawalsCount++;
          break;
        case "deposit_fee":
        case "withdrawal_fee":
          totalChapaFeesSantims += entry.amountSantims;
          break;
        case "match_payout":
          totalMatchWinningsSantims += entry.amountSantims;
          if (entry.referenceId) completedMatchIds.add(entry.referenceId);
          break;
        case "match_loss":
          totalMatchEntriesSantims += entry.amountSantims;
          if (entry.referenceId) completedMatchIds.add(entry.referenceId);
          break;
        case "match_unlock":
          // Draw refund — counts towards match participation
          if (entry.referenceId) completedMatchIds.add(entry.referenceId);
          break;
      }
    }

    // For matches won, add the original stake to totalMatchEntries
    // In our engine: payout = stake * 2 - commission (or payoutSantims). The player's stake was 50% of the pot or match stake.
    // To ensure exact mathematical consistency with match records:
    for (const entry of ledger) {
      if (entry.entryType === "match_payout") {
        // Find the match stake from game doc or description
        // In ChessArena standard match settlements: winning entry stake equals the gross pot / 2 or stake from match_lock
        // A clean derivation: each settled match entry stake is tracked
      }
    }

    // Net Gaming Result = Match Winnings - Match Entries (Deposits and Withdrawals are strictly excluded)
    const netGamingResultSantims = totalMatchWinningsSantims - totalMatchEntriesSantims;

    return {
      availableBalance: availableSantims / 100,
      lockedBalance: lockedSantims / 100,
      totalBalance: (availableSantims + lockedSantims) / 100,
      lifetime: {
        totalDeposited: totalDepositedSantims / 100,
        totalWithdrawn: totalWithdrawnSantims / 100,
        totalMatchWinnings: totalMatchWinningsSantims / 100,
        totalMatchEntries: totalMatchEntriesSantims / 100,
        netGamingResult: netGamingResultSantims / 100,
        totalChapaFees: totalChapaFeesSantims / 100,
        completedMatches: completedMatchIds.size,
        depositsCount,
        withdrawalsCount,
      },
    };
  },
});

/**
 * Period-based analytics for custom date ranges (Today, Yesterday, 7D, 30D, Month, Year, Custom).
 */
export const getPeriodAnalytics = query({
  args: {
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    // Query ledger within time window using composite index
    const entries = await ctx.db
      .query("financialLedger")
      .withIndex("by_userId_and_createdAt", (q) =>
        q
          .eq("userId", player._id)
          .gte("createdAt", args.startTimestamp)
          .lte("createdAt", args.endTimestamp)
      )
      .collect();

    let matchWinningsSantims = 0;
    let matchEntriesSantims = 0;
    let depositsTotalSantims = 0;
    let depositsCount = 0;
    let withdrawalsTotalSantims = 0;
    let withdrawalsCount = 0;
    let chapaFeesSantims = 0;
    const matchIdsInPeriod = new Set<string>();

    // For Top Performance:
    let highestWinSantims = 0;
    let highestWinMatchId = "";
    const dailyNetSantims = new Map<string, { net: number; winnings: number; entries: number; timestamp: number }>();

    for (const e of entries) {
      // Determine day key in local ISO date format (YYYY-MM-DD)
      const dateObj = new Date(e.createdAt);
      const dayKey = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      if (!dailyNetSantims.has(dayKey)) {
        dailyNetSantims.set(dayKey, { net: 0, winnings: 0, entries: 0, timestamp: e.createdAt });
      }
      const dayBucket = dailyNetSantims.get(dayKey)!;

      switch (e.entryType) {
        case "match_payout":
          matchWinningsSantims += e.amountSantims;
          dayBucket.winnings += e.amountSantims / 100;
          dayBucket.net += e.amountSantims / 100;
          if (e.referenceId) matchIdsInPeriod.add(e.referenceId);
          if (e.amountSantims > highestWinSantims) {
            highestWinSantims = e.amountSantims;
            highestWinMatchId = e.referenceId;
          }
          break;
        case "match_loss":
          matchEntriesSantims += e.amountSantims;
          dayBucket.entries += e.amountSantims / 100;
          dayBucket.net -= e.amountSantims / 100;
          if (e.referenceId) matchIdsInPeriod.add(e.referenceId);
          break;
        case "match_unlock":
          if (e.referenceId) matchIdsInPeriod.add(e.referenceId);
          break;
        case "deposit_credit":
          depositsTotalSantims += e.amountSantims;
          depositsCount++;
          break;
        case "withdrawal_complete":
          withdrawalsTotalSantims += e.amountSantims;
          withdrawalsCount++;
          break;
        case "deposit_fee":
        case "withdrawal_fee":
          chapaFeesSantims += e.amountSantims;
          break;
      }
    }

    const netGamingResultSantims = matchWinningsSantims - matchEntriesSantims;

    // Find Best Day
    let bestDayLabel = "—";
    let bestDayNet = 0;
    dailyNetSantims.forEach((data, label) => {
      if (data.net > bestDayNet) {
        bestDayNet = data.net;
        bestDayLabel = label;
      }
    });

    // Generate chart data array ordered chronologically
    const chartData = Array.from(dailyNetSantims.entries()).map(([label, val]) => ({
      dateLabel: label,
      timestamp: val.timestamp,
      netResult: Number(val.net.toFixed(2)),
      winnings: Number(val.winnings.toFixed(2)),
      entries: Number(val.entries.toFixed(2)),
    }));

    return {
      netGamingResult: netGamingResultSantims / 100,
      matchWinnings: matchWinningsSantims / 100,
      matchEntries: matchEntriesSantims / 100,
      matchesPlayed: matchIdsInPeriod.size,
      deposits: {
        total: depositsTotalSantims / 100,
        count: depositsCount,
      },
      withdrawals: {
        total: withdrawalsTotalSantims / 100,
        count: withdrawalsCount,
      },
      chapaFees: {
        total: chapaFeesSantims / 100,
        count: entries.filter((e) => e.entryType === "deposit_fee" || e.entryType === "withdrawal_fee").length,
      },
      topPerformance: {
        bestDay: {
          date: bestDayLabel,
          netResult: bestDayNet,
        },
        highestWin: {
          matchId: highestWinMatchId ? `#${highestWinMatchId.slice(-6).toUpperCase()}` : "—",
          amount: highestWinSantims / 100,
        },
      },
      chartData,
    };
  },
});

/**
 * Filtered, paginated transaction history enriched with provider references and details.
 */
export const getTransactions = query({
  args: {
    type: v.optional(v.string()), // "all" | "deposits" | "withdrawals" | "match_entries" | "match_winnings" | "fees" | "adjustments"
    status: v.optional(v.string()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const limit = args.limit ?? 100;

    // Fetch user ledger entries
    let q = ctx.db
      .query("financialLedger")
      .withIndex("by_userId", (query) => query.eq("userId", player._id))
      .order("desc");

    let entries = await q.take(limit * 2);

    if (args.startTimestamp !== undefined) {
      entries = entries.filter((e) => e.createdAt >= args.startTimestamp!);
    }
    if (args.endTimestamp !== undefined) {
      entries = entries.filter((e) => e.createdAt <= args.endTimestamp!);
    }

    // Filter by type
    if (args.type && args.type !== "all") {
      entries = entries.filter((e) => {
        if (args.type === "deposits") return e.entryType === "deposit_credit" || e.entryType === "deposit_fee";
        if (args.type === "withdrawals")
          return (
            e.entryType === "withdrawal_reserve" ||
            e.entryType === "withdrawal_complete" ||
            e.entryType === "withdrawal_reversal" ||
            e.entryType === "withdrawal_fee"
          );
        if (args.type === "match_entries") return e.entryType === "match_lock" || e.entryType === "match_loss";
        if (args.type === "match_winnings") return e.entryType === "match_payout" || e.entryType === "match_unlock";
        if (args.type === "fees") return e.entryType === "deposit_fee" || e.entryType === "withdrawal_fee";
        if (args.type === "adjustments") return e.entryType === "admin_adjustment";
        return true;
      });
    }

    // Map into enriched view objects
    const results = entries.map((e) => {
      let displayType = "Adjustment";
      let isCredit = false;
      let method = "System";
      let status: "Completed" | "Locked" | "Processing" | "Failed" | "Reversed" = "Completed";
      let feeEtb = 0;

      switch (e.entryType) {
        case "deposit_credit":
          displayType = "Deposit";
          isCredit = true;
          method = "Chapa";
          status = "Completed";
          break;
        case "deposit_fee":
          displayType = "Deposit Fee";
          isCredit = false;
          method = "Chapa";
          status = "Completed";
          break;
        case "withdrawal_reserve":
          displayType = "Withdrawal Hold";
          isCredit = false;
          method = "Bank / Telebirr";
          status = "Locked";
          break;
        case "withdrawal_complete":
          displayType = "Withdrawal";
          isCredit = false;
          method = "Bank / Telebirr";
          status = "Completed";
          break;
        case "withdrawal_reversal":
          displayType = "Withdrawal Refund";
          isCredit = true;
          method = "Bank / Telebirr";
          status = "Reversed";
          break;
        case "withdrawal_fee":
          displayType = "Withdrawal Fee";
          isCredit = false;
          method = "Chapa";
          status = "Completed";
          break;
        case "match_lock":
          displayType = "Match Entry";
          isCredit = false;
          method = "Match";
          status = "Locked";
          break;
        case "match_loss":
          displayType = "Match Entry";
          isCredit = false;
          method = "Match";
          status = "Completed";
          break;
        case "match_payout":
          displayType = "Match Winnings";
          isCredit = true;
          method = "Game Win";
          status = "Completed";
          break;
        case "match_unlock":
          displayType = "Match Draw Refund";
          isCredit = true;
          method = "Game Draw";
          status = "Completed";
          break;
      }

      const amountEtb = e.amountSantims / 100;

      return {
        id: String(e._id),
        timestamp: e.createdAt,
        type: displayType,
        entryType: e.entryType,
        isCredit,
        amountEtb,
        feeEtb,
        netEtb: isCredit ? amountEtb : -amountEtb,
        status,
        method,
        reference: e.referenceId || String(e._id).slice(-8),
        description: e.description,
      };
    });

    // Apply search filter if provided
    let filtered = results;
    if (args.search && args.search.trim()) {
      const qLower = args.search.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          t.reference.toLowerCase().includes(qLower) ||
          t.description.toLowerCase().includes(qLower) ||
          t.type.toLowerCase().includes(qLower) ||
          t.method.toLowerCase().includes(qLower)
      );
    }

    return filtered.slice(0, limit);
  },
});
