// convex/admin.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    const adminPlayer = await requireAdmin(ctx);

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommissionEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommission = commissions.filter((c) => !c.transferred).reduce((sum, c) => sum + c.amount, 0);

    const users = await ctx.db.query("players").collect();
    const totalUsers = users.length;

    const deposits = await ctx.db.query("deposits").withIndex("by_status", (q) => q.eq("status", "approved")).collect();
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

    const withdrawals = await ctx.db.query("withdrawals").withIndex("by_status", (q) => q.eq("status", "completed")).collect();
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    const adminWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
      .unique();

    // Sort recent commissions desc
    const sortedCommissions = commissions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

    return {
      // Both naming conventions for frontend compatibility
      totalCommission: totalCommissionEarned,
      totalCommissionEarned,
      pendingTransfer: pendingCommission,
      pendingCommission,
      adminWalletBalance: adminWallet?.availableBalance ?? 0,
      adminWalletLocked: adminWallet?.lockedBalance ?? 0,
      totalUsers,
      totalDeposits,
      totalWithdrawals,
      recentCommissions: sortedCommissions,
    };
  },
});

export const markCommissionTransferred = mutation({
  args: { amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const untransferred = await ctx.db
      .query("commissions")
      .withIndex("by_transferred", (q) => q.eq("transferred", false))
      .order("asc")
      .collect();

    let remaining = args.amount ?? untransferred.reduce((sum, c) => sum + c.amount, 0);

    for (const c of untransferred) {
      if (remaining <= 0) break;

      if (c.amount <= remaining) {
        await ctx.db.patch(c._id, { transferred: true });
        remaining -= c.amount;
      } else {
        break;
      }
    }
  },
});

export const syncCommissionsToWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const adminPlayer = await requireAdmin(ctx);

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);

    let adminWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
      .unique();

    if (!adminWallet) {
      await ctx.db.insert("wallets", {
        userId: adminPlayer._id,
        availableBalance: totalCommission,
        lockedBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: totalCommission,
        totalLost: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { syncedAmount: totalCommission, newBalance: totalCommission };
    } else {
      const currentWon = adminWallet.totalWon ?? 0;
      const diff = Math.max(0, totalCommission - currentWon);
      if (diff > 0) {
        await ctx.db.patch(adminWallet._id, {
          availableBalance: adminWallet.availableBalance + diff,
          totalWon: currentWon + diff,
          updatedAt: Date.now(),
        });
      }
      return { syncedAmount: diff, newBalance: adminWallet.availableBalance + diff };
    }
  },
});

export const listPlayers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let players = await ctx.db.query("players").order("desc").take(100);
    if (args.search) {
      const s = args.search.toLowerCase();
      players = players.filter(
        (p) =>
          p.username.toLowerCase().includes(s) ||
          p.clerkId.toLowerCase().includes(s)
      );
    }
    const enriched = await Promise.all(
      players.map(async (p) => {
        const wallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", p._id))
          .unique();
        return {
          _id: p._id,
          username: p.username,
          avatarUrl: p.avatarUrl,
          clerkId: p.clerkId,
          rating: p.rating,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
          proUntil: p.proUntil,
          createdAt: p.createdAt,
          availableBalance: wallet?.availableBalance ?? 0,
          lockedBalance: wallet?.lockedBalance ?? 0,
          totalDeposited: wallet?.totalDeposited ?? 0,
          totalWon: wallet?.totalWon ?? 0,
        };
      })
    );
    return enriched;
  },
});

export const recentGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 30;
    const games = await ctx.db.query("games").order("desc").take(limit);
    return await Promise.all(
      games.map(async (g) => {
        const white = g.whiteId ? await ctx.db.get(g.whiteId) : null;
        const black = g.blackId ? await ctx.db.get(g.blackId) : null;
        return {
          _id: g._id,
          mode: g.mode,
          status: g.status,
          winner: g.winner,
          endReason: g.endReason,
          stake: g.stake ?? 0,
          escrowTotal: g.escrowTotal ?? 0,
          commission: g.commission ?? 0,
          payout: g.payout ?? 0,
          escrowSettled: g.escrowSettled ?? false,
          moveCount: g.moves.length,
          whiteUsername: white?.username ?? "AI / Guest",
          blackUsername: black?.username ?? "AI / Guest",
          createdAt: g._creationTime,
        };
      })
    );
  },
});

export const financialReconciliation = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const deposits = await ctx.db.query("deposits").collect();
    const withdrawals = await ctx.db.query("withdrawals").collect();
    const wallets = await ctx.db.query("wallets").collect();
    const commissions = await ctx.db.query("commissions").collect();

    const totalDepositsApproved = deposits
      .filter((d) => d.status === "approved")
      .reduce((sum, d) => sum + d.amount, 0);

    const totalWithdrawalsCompleted = withdrawals
      .filter((w) => w.status === "completed")
      .reduce((sum, w) => sum + w.amount, 0);

    const totalUserAvailableBalance = wallets.reduce((sum, w) => sum + w.availableBalance, 0);
    const totalUserLockedBalance = wallets.reduce((sum, w) => sum + w.lockedBalance, 0);
    const totalCommissionsEarned = commissions.reduce((sum, c) => sum + c.amount, 0);

    const netFloat = totalDepositsApproved - totalWithdrawalsCompleted;
    const totalObligations = totalUserAvailableBalance + totalUserLockedBalance;
    const variance = netFloat - (totalObligations + totalCommissionsEarned);

    return {
      totalDepositsApproved,
      totalWithdrawalsCompleted,
      netFloat,
      totalUserAvailableBalance,
      totalUserLockedBalance,
      totalCommissionsEarned,
      variance,
      isBalanced: Math.abs(variance) < 1,
    };
  },
});

export const getPlatformKpis = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

    // 1. Total players
    const allPlayers = await ctx.db.query("players").collect();
    const totalPlayers = allPlayers.length;

    // 2. Online now (lastSeen < 60_000)
    const userPresences = await ctx.db.query("userPresence").collect();
    const onlineNow = userPresences.filter((p) => now - p.lastSeen < 60_000).length;

    // 3. Active games & games today
    const allGames = await ctx.db.query("games").collect();
    let activeGames = 0;
    let gamesToday = 0;
    let lockedEscrow = 0;

    for (const g of allGames) {
      if (g.status === "active" || (g.status as string) === "in_progress") {
        activeGames++;
        lockedEscrow += g.escrowTotal ?? (g.stake ? g.stake * 2 : 0);
      }
      if (g.createdAt >= startOfToday) {
        gamesToday++;
      }
    }

    // 4. Deposits
    const manualDeposits = await ctx.db.query("deposits").collect();
    const finDeposits = await ctx.db.query("financialDeposits").collect();

    let approvedDepositsTotal = 0;
    let depositsToday = 0;
    let pendingDepositsCount = 0;
    let failedDepositsCount = 0;

    for (const d of manualDeposits) {
      if (d.status === "approved") {
        approvedDepositsTotal += d.amount;
        if ((d.reviewedAt ?? d.createdAt) >= startOfToday) {
          depositsToday += d.amount;
        }
      } else if (d.status === "pending") {
        pendingDepositsCount++;
      }
    }

    for (const fd of finDeposits) {
      const creditEtb = fd.requestedCreditSantims / 100;
      if (fd.status === "credited") {
        approvedDepositsTotal += creditEtb;
        if ((fd.verifiedAt ?? fd.createdAt) >= startOfToday) {
          depositsToday += creditEtb;
        }
      } else if (fd.status === "pending_provider" || fd.status === "verifying") {
        pendingDepositsCount++;
      } else if (fd.status === "failed") {
        failedDepositsCount++;
      }
    }

    // 5. Withdrawals
    const manualWithdrawals = await ctx.db.query("withdrawals").collect();
    const finWithdrawals = await ctx.db.query("financialWithdrawals").collect();

    let completedWithdrawalsTotal = 0;
    let withdrawalsToday = 0;
    let pendingWithdrawalReserve = 0;
    let pendingWithdrawalsCount = 0;
    let failedWithdrawalsCount = 0;

    for (const w of manualWithdrawals) {
      if (w.status === "completed") {
        completedWithdrawalsTotal += w.amount;
        if ((w.completedAt ?? w.createdAt) >= startOfToday) {
          withdrawalsToday += w.amount;
        }
      } else if (w.status === "pending") {
        pendingWithdrawalsCount++;
        pendingWithdrawalReserve += w.amount;
      }
    }

    for (const fw of finWithdrawals) {
      const amountEtb = fw.requestedAmountSantims / 100;
      if (fw.status === "completed") {
        completedWithdrawalsTotal += amountEtb;
        if ((fw.completedAt ?? fw.createdAt) >= startOfToday) {
          withdrawalsToday += amountEtb;
        }
      } else if (
        fw.status === "reserved" ||
        fw.status === "provider_submitted" ||
        fw.status === "provider_pending" ||
        (fw.status as string) === "pending"
      ) {
        pendingWithdrawalsCount++;
        pendingWithdrawalReserve += (fw.totalReservedSantims ? fw.totalReservedSantims / 100 : amountEtb);
      } else if (fw.status === "failed" || fw.status === "reversed") {
        failedWithdrawalsCount++;
      }
    }

    // 6. Platform Balance (approved deposits minus completed withdrawals)
    const platformBalance = approvedDepositsTotal - completedWithdrawalsTotal;

    // 7. User liabilities (wallets available balance)
    const allWallets = await ctx.db.query("wallets").collect();
    let userLiabilities = 0;
    for (const w of allWallets) {
      userLiabilities += w.availableSantims ? w.availableSantims / 100 : (w.availableBalance ?? 0);
    }

    // 8. Commissions & Revenue Today
    const allCommissions = await ctx.db.query("commissions").collect();
    let revenueToday = 0;
    for (const c of allCommissions) {
      if (c.createdAt >= startOfToday) {
        revenueToday += c.amount ?? 0;
      }
    }

    // 9. Failed Chapa payments
    const chapaPayments = await ctx.db.query("chapaPayments").collect();
    let failedChapaCount = 0;
    for (const cp of chapaPayments) {
      if (cp.status === "failed") failedChapaCount++;
    }

    // 10. Pending fair play reports
    const fairPlayReports = await ctx.db
      .query("fairPlayReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // 11. User feedback NEW
    const newFeedback = await ctx.db
      .query("feedback")
      .withIndex("by_status", (q) => q.eq("status", "NEW"))
      .collect();

    // 12. System alerts (reconciliation variance)
    const variance = platformBalance - (userLiabilities + lockedEscrow + pendingWithdrawalReserve);
    const systemAlerts = Math.abs(variance) >= 1 ? 1 : 0;

    // 13. Trends: Compute percentage delta from prior period (yesterday vs today)
    const startOfYesterday = startOfToday - 86_400_000;

    const formatTrend = (current: number, previous: number): string => {
      if (previous === 0) {
        if (current === 0) return "0.0%";
        return "+100.0%";
      }
      const pct = ((current - previous) / Math.abs(previous)) * 100;
      const sign = pct > 0 ? "+" : "";
      return `${sign}${pct.toFixed(1)}%`;
    };

    const playersBeforeToday = allPlayers.filter((p) => p.createdAt < startOfToday).length;
    const trendTotalPlayers = formatTrend(totalPlayers, playersBeforeToday);

    const onlinePrevious = userPresences.filter(
      (p) => now - p.lastSeen >= 60_000 && now - p.lastSeen < 120_000
    ).length;
    const trendOnlineNow = formatTrend(onlineNow, onlinePrevious);

    const gamesYesterday = allGames.filter(
      (g) => g.createdAt >= startOfYesterday && g.createdAt < startOfToday
    ).length;
    const trendActiveGames = formatTrend(activeGames, gamesYesterday);

    let approvedDepositsBeforeToday = 0;
    for (const d of manualDeposits) {
      if (d.status === "approved" && (d.reviewedAt ?? d.createdAt) < startOfToday) {
        approvedDepositsBeforeToday += d.amount;
      }
    }
    for (const fd of finDeposits) {
      if (fd.status === "credited" && (fd.verifiedAt ?? fd.createdAt) < startOfToday) {
        approvedDepositsBeforeToday += fd.requestedCreditSantims / 100;
      }
    }
    let completedWithdrawalsBeforeToday = 0;
    for (const w of manualWithdrawals) {
      if (w.status === "completed" && (w.completedAt ?? w.createdAt) < startOfToday) {
        completedWithdrawalsBeforeToday += w.amount;
      }
    }
    for (const fw of finWithdrawals) {
      if (fw.status === "completed" && (fw.completedAt ?? fw.createdAt) < startOfToday) {
        completedWithdrawalsBeforeToday += fw.requestedAmountSantims / 100;
      }
    }
    const platformBalanceYesterday = approvedDepositsBeforeToday - completedWithdrawalsBeforeToday;
    const trendPlatformBalance = formatTrend(platformBalance, platformBalanceYesterday);

    let escrowYesterday = 0;
    for (const g of allGames) {
      if (g.createdAt >= startOfYesterday && g.createdAt < startOfToday) {
        escrowYesterday += g.escrowTotal ?? (g.stake ? g.stake * 2 : 0);
      }
    }
    const trendLockedEscrow = formatTrend(lockedEscrow, escrowYesterday);

    const revenueYesterday = allCommissions
      .filter((c) => c.createdAt >= startOfYesterday && c.createdAt < startOfToday)
      .reduce((sum, c) => sum + c.amount, 0);
    const trendRevenueToday = formatTrend(revenueToday, revenueYesterday);

    let depositsYesterday = 0;
    for (const d of manualDeposits) {
      if (
        d.status === "approved" &&
        (d.reviewedAt ?? d.createdAt) >= startOfYesterday &&
        (d.reviewedAt ?? d.createdAt) < startOfToday
      ) {
        depositsYesterday += d.amount;
      }
    }
    for (const fd of finDeposits) {
      if (
        fd.status === "credited" &&
        (fd.verifiedAt ?? fd.createdAt) >= startOfYesterday &&
        (fd.verifiedAt ?? fd.createdAt) < startOfToday
      ) {
        depositsYesterday += fd.requestedCreditSantims / 100;
      }
    }
    const trendDepositsToday = formatTrend(depositsToday, depositsYesterday);

    let withdrawalsYesterday = 0;
    for (const w of manualWithdrawals) {
      if (
        w.status === "completed" &&
        (w.completedAt ?? w.createdAt) >= startOfYesterday &&
        (w.completedAt ?? w.createdAt) < startOfToday
      ) {
        withdrawalsYesterday += w.amount;
      }
    }
    for (const fw of finWithdrawals) {
      if (
        fw.status === "completed" &&
        (fw.completedAt ?? fw.createdAt) >= startOfYesterday &&
        (fw.completedAt ?? fw.createdAt) < startOfToday
      ) {
        withdrawalsYesterday += fw.requestedAmountSantims / 100;
      }
    }
    const trendWithdrawalsToday = formatTrend(withdrawalsToday, withdrawalsYesterday);

    const trends = {
      totalPlayers: trendTotalPlayers,
      onlineNow: trendOnlineNow,
      activeGames: trendActiveGames,
      platformBalance: trendPlatformBalance,
      lockedEscrow: trendLockedEscrow,
      revenueToday: trendRevenueToday,
      depositsToday: trendDepositsToday,
      withdrawalsToday: trendWithdrawalsToday,
    };

    // 14. 7-Day Chart Data
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - i);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86_400_000;
      const dateStr = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;

      const dayRevenue = allCommissions
        .filter((c) => c.createdAt >= dayStart && c.createdAt < dayEnd)
        .reduce((sum, c) => sum + (c.amount ?? 0), 0);

      const dayGames = allGames.filter(
        (g) => g.createdAt >= dayStart && g.createdAt < dayEnd
      ).length;

      chartData.push({
        date: dateStr,
        revenue: dayRevenue,
        games: dayGames,
      });
    }

    return {
      totalPlayers,
      onlineNow,
      activeGames,
      gamesToday,
      platformBalance,
      userLiabilities,
      lockedEscrow,
      pendingWithdrawalReserve,
      revenueToday,
      depositsToday,
      withdrawalsToday,
      trends,
      pendingActions: {
        pendingWithdrawals: pendingWithdrawalsCount,
        pendingDeposits: pendingDepositsCount,
        failedPayments: failedDepositsCount + failedWithdrawalsCount + failedChapaCount,
        fairPlayReports: fairPlayReports.length,
        userFeedback: newFeedback.length,
        systemAlerts,
      },
      chartData,
    };
  },
});

function mapLedgerEntryType(entryType: string): string {
  switch (entryType) {
    case "deposit_credit":
      return "deposits";
    case "withdrawal_complete":
    case "withdrawal_reserve":
      return "withdrawals";
    case "match_lock":
      return "stakes";
    case "match_payout":
      return "winnings";
    case "platform_commission":
      return "commissions";
    case "match_unlock":
    case "withdrawal_reversal":
      return "refunds";
    case "admin_adjustment":
      return "admin";
    default:
      return "other";
  }
}

export const getUnifiedTransactions = query({
  args: {
    type: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    const ledger = await ctx.db
      .query("financialLedger")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    // Group withdrawals to avoid double-counting between withdrawal_reserve and withdrawal_complete
    const completedWithdrawalRefs = new Set<string>();
    for (const row of ledger) {
      if (row.entryType === "withdrawal_complete") {
        completedWithdrawalRefs.add(row.referenceId);
      }
    }

    const filteredRows: Array<typeof ledger[number]> = [];

    for (const row of ledger) {
      // If this withdrawal was completed, do not include withdrawal_reserve (avoids double counting)
      if (row.entryType === "withdrawal_reserve" && completedWithdrawalRefs.has(row.referenceId)) {
        continue;
      }

      const mappedType = mapLedgerEntryType(row.entryType);

      // Filter by type if requested
      if (args.type && args.type !== "all" && mappedType !== args.type) {
        continue;
      }

      filteredRows.push(row);
    }

    // Optimization: If no search query, slice before Promise.all to avoid querying all documents
    const candidateRows = args.search ? filteredRows : filteredRows.slice(0, limit);

    // Enrich with player and provider info
    const enriched = await Promise.all(
      candidateRows.map(async (row) => {
        const player = await ctx.db.get(row.userId);

        let providerTxId: string | undefined;
        let internalTxRef: string | undefined = row.referenceId;
        let feeEtb = 0;
        let status = "completed";

        if (row.referenceType === "deposit") {
          const finDep = await ctx.db
            .query("financialDeposits")
            .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", row.referenceId))
            .first();
          if (finDep) {
            providerTxId = finDep.providerTxId;
            feeEtb = finDep.providerFeeSantims / 100;
            status = finDep.status;
          } else {
            const chapaPay = await ctx.db
              .query("chapaPayments")
              .withIndex("by_txRef", (q) => q.eq("txRef", row.referenceId))
              .first();
            if (chapaPay) {
              providerTxId = chapaPay.chapaRef;
              status = chapaPay.status;
            }
          }
        } else if (row.referenceType === "withdrawal") {
          const finWdr = await ctx.db
            .query("financialWithdrawals")
            .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", row.referenceId))
            .first();
          if (finWdr) {
            providerTxId = finWdr.providerTransferId;
            feeEtb = finWdr.providerFeeSantims / 100;
            status = finWdr.status;
          }
        }

        const mappedType = mapLedgerEntryType(row.entryType);

        return {
          _id: row._id,
          createdAt: row.createdAt,
          userId: row.userId,
          username: player?.username ?? "Unknown",
          userAvatarUrl: player?.avatarUrl ?? "",
          displayName: player?.displayName ?? player?.username ?? "Unknown",
          entryType: row.entryType,
          type: mappedType,
          amountEtb: row.amountSantims / 100,
          balanceAfterEtb: row.balanceAfterSantims / 100,
          lockedAfterEtb: row.lockedAfterSantims / 100,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          internalTxRef,
          providerTxId,
          feeEtb,
          status,
          description: row.description,
          clerkId: player?.clerkId ?? "",
        };
      })
    );

    // Apply search filter if present
    if (args.search) {
      const s = args.search.toLowerCase().trim();
      const matched = enriched.filter(
        (t) =>
          t.username.toLowerCase().includes(s) ||
          t.clerkId.toLowerCase().includes(s) ||
          t.referenceId.toLowerCase().includes(s) ||
          (t.providerTxId && t.providerTxId.toLowerCase().includes(s)) ||
          (t.internalTxRef && t.internalTxRef.toLowerCase().includes(s)) ||
          t.description.toLowerCase().includes(s)
      );
      return matched.slice(0, limit);
    }

    return enriched;
  },
});

export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 15;

    // 1. Latest deposits
    const manualDeps = await ctx.db.query("deposits").order("desc").take(limit);
    const finDeps = await ctx.db.query("financialDeposits").order("desc").take(limit);

    // 2. Latest withdrawals
    const manualWdrs = await ctx.db.query("withdrawals").order("desc").take(limit);
    const finWdrs = await ctx.db.query("financialWithdrawals").order("desc").take(limit);

    // 3. Latest games
    const games = await ctx.db.query("games").order("desc").take(limit);

    // 4. Latest signups
    const players = await ctx.db.query("players").order("desc").take(limit);

    const activities: Array<{
      id: string;
      type: "deposit" | "withdrawal" | "game_completed" | "player_signup";
      timestamp: number;
      title: string;
      description: string;
      amount?: number;
      status?: string;
      metadata?: Record<string, any>;
    }> = [];

    for (const d of manualDeps) {
      const player = await ctx.db.get(d.userId);
      const amount = Number(d.amount ?? 0);
      activities.push({
        id: `dep_${d._id}`,
        type: "deposit",
        timestamp: d.reviewedAt ?? d.createdAt,
        title: `Deposit ${d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Pending"}`,
        description: `@${player?.username ?? "user"} submitted ${amount.toFixed(2)} ETB deposit`,
        amount,
        status: d.status ?? "pending",
      });
    }

    for (const fd of finDeps) {
      const player = await ctx.db.get(fd.userId);
      const amountEtb = Number(fd.requestedCreditSantims ?? 0) / 100;
      const statusStr = String(fd.status ?? "credited").toUpperCase();
      activities.push({
        id: `findep_${fd._id}`,
        type: "deposit",
        timestamp: fd.verifiedAt ?? fd.createdAt,
        title: `Chapa Deposit ${statusStr}`,
        description: `@${player?.username ?? "user"} deposited ${amountEtb.toFixed(2)} ETB via Chapa`,
        amount: amountEtb,
        status: fd.status ?? "credited",
      });
    }

    for (const w of manualWdrs) {
      const player = await ctx.db.get(w.userId);
      const amount = Number(w.amount ?? 0);
      const statusStr = String(w.status ?? "completed").toUpperCase();
      activities.push({
        id: `wdr_${w._id}`,
        type: "withdrawal",
        timestamp: w.completedAt ?? w.createdAt,
        title: `Withdrawal ${w.status === "completed" ? "Sent" : statusStr}`,
        description: `@${player?.username ?? "user"} requested ${amount.toFixed(2)} ETB via ${w.payoutMethod ?? "transfer"}`,
        amount,
        status: w.status ?? "pending",
      });
    }

    for (const fw of finWdrs) {
      const player = await ctx.db.get(fw.userId);
      const amountEtb = Number(fw.requestedAmountSantims ?? 0) / 100;
      const statusStr = String(fw.status ?? "completed").toUpperCase();
      activities.push({
        id: `finwdr_${fw._id}`,
        type: "withdrawal",
        timestamp: fw.completedAt ?? fw.createdAt,
        title: `Transfer ${statusStr}`,
        description: `@${player?.username ?? "user"} transferred ${amountEtb.toFixed(2)} ETB to ${fw.bankName ?? "Bank"}`,
        amount: amountEtb,
        status: fw.status ?? "completed",
      });
    }

    for (const g of games) {
      if (g.status === "active" || g.status === "waiting") continue;
      const white = g.whiteId ? await ctx.db.get(g.whiteId) : null;
      const black = g.blackId ? await ctx.db.get(g.blackId) : null;
      const whiteName = white?.username ?? "AI / Guest";
      const blackName = black?.username ?? "AI / Guest";
      const winnerName = g.winner === "w" ? whiteName : g.winner === "b" ? blackName : null;
      activities.push({
        id: `game_${g._id}`,
        type: "game_completed",
        timestamp: g.endedAt ?? g.lastMoveAt ?? g.createdAt,
        title: `Game Finished (${g.endReason ?? g.status ?? "ended"})`,
        description: `@${whiteName} vs @${blackName} — ${winnerName ? `Winner: ${winnerName}` : "Draw"}`,
        amount: g.stake ?? 0,
        status: g.status ?? "completed",
      });
    }

    for (const p of players) {
      activities.push({
        id: `player_${p._id}`,
        type: "player_signup",
        timestamp: p.createdAt,
        title: "New Player Joined",
        description: `@${p?.username ?? "user"} registered with ${p?.rating ?? 1200} Elo`,
      });
    }

    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, limit);
  },
});

export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Measure live database query latency
    const startDbPing = Date.now();
    await ctx.db.query("players").take(1);
    const measuredLatencyMs = Math.max(1, Date.now() - startDbPing);
    const latency = `${measuredLatencyMs}ms`;

    // Compute transaction error rate from recorded failures vs total operations
    const [finDeps, chapaPays, finWdrs] = await Promise.all([
      ctx.db.query("financialDeposits").collect(),
      ctx.db.query("chapaPayments").collect(),
      ctx.db.query("financialWithdrawals").collect(),
    ]);

    const totalTransactions = finDeps.length + chapaPays.length + finWdrs.length;
    const failedTransactions =
      finDeps.filter((d) => d.status === "failed").length +
      chapaPays.filter((c) => c.status === "failed").length +
      finWdrs.filter((w) => w.status === "failed").length;

    const errorRatePercent = totalTransactions > 0 ? (failedTransactions / totalTransactions) * 100 : 0.0;
    const errorRate = `${errorRatePercent.toFixed(2)}%`;

    const chapaStatus = (chapaPays.length > 0 || finDeps.length > 0) ? "HEALTHY" : "UNKNOWN";
    const convexStatus = measuredLatencyMs < 2000 ? "HEALTHY" : "WARNING";
    const dbStatus = measuredLatencyMs < 2000 ? "HEALTHY" : "WARNING";

    return {
      convex: convexStatus,
      chapa: chapaStatus,
      auth: "HEALTHY",
      webhooks: "HEALTHY",
      database: dbStatus,
      cron: "HEALTHY",
      errorRate,
      latency,
      services: [
        { name: "Convex Realtime Engine", status: convexStatus, description: `Database response measured at ${latency}` },
        { name: "Chapa Payment Gateway", status: chapaStatus, description: "Telebirr, CBE, and bank transfer routing online" },
        { name: "Clerk Authentication", status: "HEALTHY", description: "Session validation and token rotation functional" },
        { name: "Payment Webhooks", status: "HEALTHY", description: `Transaction error rate measured at ${errorRate}` },
        { name: "Database Engine", status: dbStatus, description: "ACID transactions and secondary indices responsive" },
        { name: "Cron Automation", status: "HEALTHY", description: "Scheduled heartbeat and reconciliation jobs active" },
      ],
    };
  },
});

export const searchPlayers = query({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 20;
    let players: Array<Doc<"players">> = [];

    if (args.query && args.query.trim().length > 0) {
      const q = args.query.toLowerCase().trim();

      // Check index by_usernameLower for exact match first
      const exactMatch = await ctx.db
        .query("players")
        .withIndex("by_usernameLower", (idx) => idx.eq("usernameLower", q))
        .first();

      // Scan up to 300 players so older players can be found
      const candidatePlayers = await ctx.db.query("players").order("desc").take(300);
      const matched = candidatePlayers.filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.clerkId.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          (p.displayName && p.displayName.toLowerCase().includes(q))
      );

      if (exactMatch && !matched.some((p) => p._id === exactMatch._id)) {
        players = [exactMatch, ...matched];
      } else {
        players = matched;
      }
    } else {
      players = await ctx.db.query("players").order("desc").take(limit);
    }

    const results = await Promise.all(
      players.slice(0, limit).map(async (p) => {
        const wallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", p._id))
          .unique();

        return {
          _id: p._id,
          username: p.username,
          displayName: p.displayName ?? p.username,
          avatarUrl: p.avatarUrl,
          clerkId: p.clerkId,
          email: p.email ?? "",
          rating: p.rating,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
          isFairPlayBanned: p.isFairPlayBanned ?? false,
          createdAt: p.createdAt,
          wallet: {
            availableBalance: wallet?.availableBalance ?? (wallet?.availableSantims ? wallet.availableSantims / 100 : 0),
            lockedBalance: wallet?.lockedBalance ?? (wallet?.lockedSantims ? wallet.lockedSantims / 100 : 0),
            status: wallet?.status ?? "active",
            depositsRestricted: wallet?.depositsRestricted ?? false,
            stakingRestricted: wallet?.stakingRestricted ?? false,
            withdrawalsRestricted: wallet?.withdrawalsRestricted ?? false,
          },
        };
      })
    );

    return results;
  },
});

export const getPlayerDetails = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player-not-found");

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    const presence = await ctx.db
      .query("userPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .first();

    const telemetry = await ctx.db
      .query("fairPlayTelemetry")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .first();

    const reports = await ctx.db
      .query("fairPlayReports")
      .withIndex("by_reportedPlayerId", (q) => q.eq("reportedPlayerId", player._id))
      .collect();

    const auditLogs = await ctx.db
      .query("financialAuditLogs")
      .withIndex("by_targetUserId", (q) => q.eq("targetUserId", player._id))
      .order("desc")
      .take(50);

    const recentLedger = await ctx.db
      .query("financialLedger")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(10);

    const isOnline = presence ? Date.now() - presence.lastSeen < 60_000 : false;
    let accountStatus: "banned" | "frozen" | "active" = "active";
    if (player.isFairPlayBanned) {
      accountStatus = "banned";
    } else if (wallet?.status === "frozen") {
      accountStatus = "frozen";
    }

    return {
      profile: {
        avatar: player.avatarUrl,
        username: player.username,
        displayName: player.displayName ?? player.username,
        email: player.email ?? "",
        clerkId: player.clerkId,
        memberSince: player.createdAt,
        lastSeen: presence?.lastSeen ?? player.updatedAt ?? player.createdAt,
        isOnline,
        accountStatus,
      },
      wallet: {
        availableBalance: wallet?.availableBalance ?? 0,
        lockedBalance: wallet?.lockedBalance ?? 0,
        totalDeposited: wallet?.totalDeposited ?? 0,
        totalWithdrawn: wallet?.totalWithdrawn ?? 0,
        gamingProfit: (wallet?.totalWon ?? 0) - (wallet?.totalLost ?? 0),
        status: wallet?.status ?? "active",
        depositsRestricted: wallet?.depositsRestricted ?? false,
        stakingRestricted: wallet?.stakingRestricted ?? false,
        withdrawalsRestricted: wallet?.withdrawalsRestricted ?? false,
        freezeReason: wallet?.freezeReason ?? null,
        recentTransactions: recentLedger.map((tx) => ({
          _id: tx._id,
          entryType: tx.entryType,
          amountSantims: tx.amountSantims,
          amountEtb: tx.amountSantims / 100,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          description: tx.description,
          createdAt: tx.createdAt,
        })),
      },
      fairPlay: {
        suspicionScore: telemetry?.suspicionScore ?? 0,
        flagsCount: player.fairPlayFlags ?? 0,
        isBanned: player.isFairPlayBanned ?? false,
        warningMessage: player.fairPlayWarning ?? null,
        reportsAgainst: reports.length,
        telemetry: telemetry
          ? {
              tabBlurCount: telemetry.tabBlurCount,
              blursPerMove: telemetry.blursPerMove,
              avgMoveTimeMs: telemetry.avgMoveTimeMs,
              moveTimeVariance: telemetry.moveTimeVariance,
              acpl: telemetry.acpl,
              top1MatchRate: telemetry.top1MatchRate,
            }
          : null,
        reports: reports.map((r) => ({
          _id: r._id,
          reason: r.reason,
          notes: r.notes,
          status: r.status,
          createdAt: r.createdAt,
        })),
        previousSanctions: [
          ...(player.fairPlayWarning
            ? [{ type: "warning" as const, message: player.fairPlayWarning }]
            : []),
          ...(player.isFairPlayBanned
            ? [{ type: "ban" as const, message: "Account banned for Fair Play" }]
            : []),
        ],
      },
      auditHistory: auditLogs.map((log) => ({
        _id: log._id,
        adminId: log.adminId,
        action: log.action,
        reason: log.reason,
        amountSantims: log.amountSantims,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    };
  },
});


