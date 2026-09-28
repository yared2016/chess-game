// convex/achievements.ts
// Dynamic Achievements & Badges Engine for Castle Chess.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalPlayer, requirePlayer } from "./lib/auth";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  category: "combat" | "tactics" | "mastery" | "speed";
  badgeIcon: string;
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  {
    key: "first_win",
    title: "First Blood",
    description: "Win your first online or AI chess match.",
    category: "combat",
    badgeIcon: "⚔️",
  },
  {
    key: "streak_3",
    title: "On Fire",
    description: "Win 3 matches in a row.",
    category: "combat",
    badgeIcon: "🔥",
  },
  {
    key: "streak_5",
    title: "Unstoppable Force",
    description: "Achieve a 5-match winning streak.",
    category: "combat",
    badgeIcon: "⚡",
  },
  {
    key: "puzzle_10",
    title: "Tactical Initiate",
    description: "Solve 10 tactical chess puzzles.",
    category: "tactics",
    badgeIcon: "🎯",
  },
  {
    key: "puzzle_50",
    title: "Grandmaster Intuition",
    description: "Successfully solve 50 tactical puzzles.",
    category: "tactics",
    badgeIcon: "🧩",
  },
  {
    key: "elo_1400",
    title: "Rising Challenger",
    description: "Surpass 1400 Elo rating in Castle Chess.",
    category: "mastery",
    badgeIcon: "🛡️",
  },
  {
    key: "elo_1600",
    title: "Castle Expert",
    description: "Ascend past 1600 Elo rating threshold.",
    category: "mastery",
    badgeIcon: "👑",
  },
  {
    key: "speed_bullet",
    title: "Lightning Striker",
    description: "Score a victory in bullet chess (sub-3 minutes).",
    category: "speed",
    badgeIcon: "⚡",
  },
  {
    key: "arena_warrior",
    title: "Arena Warrior",
    description: "Compete and score points in a live tournament arena.",
    category: "mastery",
    badgeIcon: "🏟️",
  },
  {
    key: "opening_scholar",
    title: "Opening Scholar",
    description: "Study and complete an interactive opening drill.",
    category: "tactics",
    badgeIcon: "📖",
  },
];

export const getPlayerAchievements = query({
  args: { playerId: v.optional(v.id("players")) },
  handler: async (ctx, args) => {
    let targetPlayer;
    if (args.playerId) {
      targetPlayer = await ctx.db.get("players", args.playerId);
    } else {
      targetPlayer = await optionalPlayer(ctx);
    }

    if (!targetPlayer) {
      return ACHIEVEMENTS_CATALOG.map((def) => ({
        ...def,
        progress: 0,
        isUnlocked: false,
        unlockedAt: undefined,
      }));
    }

    const existing = await ctx.db
      .query("playerAchievements")
      .withIndex("by_playerId", (q) => q.eq("playerId", targetPlayer!._id))
      .collect();

    const existingMap = new Map(existing.map((e) => [e.achievementKey, e]));

    return ACHIEVEMENTS_CATALOG.map((def) => {
      const record = existingMap.get(def.key);
      return {
        ...def,
        progress: record?.progress ?? 0,
        isUnlocked: record?.isUnlocked ?? false,
        unlockedAt: record?.unlockedAt,
      };
    });
  },
});

export const checkAndUnlockAchievements = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    // Query existing achievements for this player
    const existing = await ctx.db
      .query("playerAchievements")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const existingMap = new Map(existing.map((e) => [e.achievementKey, e]));

    const newlyUnlocked: AchievementDef[] = [];

    // Evaluate conditions
    const evaluations: { key: string; unlocked: boolean; progress: number }[] = [
      {
        key: "first_win",
        unlocked: player.wins >= 1,
        progress: Math.min(100, (player.wins / 1) * 100),
      },
      {
        key: "streak_3",
        unlocked: (player.puzzleStreak ?? 0) >= 3 || player.wins >= 3,
        progress: Math.min(100, (Math.max(player.puzzleStreak ?? 0, player.wins) / 3) * 100),
      },
      {
        key: "streak_5",
        unlocked: (player.bestPuzzleStreak ?? 0) >= 5,
        progress: Math.min(100, ((player.bestPuzzleStreak ?? 0) / 5) * 100),
      },
      {
        key: "puzzle_10",
        unlocked: (player.puzzlesSolved ?? 0) >= 10,
        progress: Math.min(100, ((player.puzzlesSolved ?? 0) / 10) * 100),
      },
      {
        key: "puzzle_50",
        unlocked: (player.puzzlesSolved ?? 0) >= 50,
        progress: Math.min(100, ((player.puzzlesSolved ?? 0) / 50) * 100),
      },
      {
        key: "elo_1400",
        unlocked: player.rating >= 1400,
        progress: Math.min(100, Math.max(0, ((player.rating - 1200) / 200) * 100)),
      },
      {
        key: "elo_1600",
        unlocked: player.rating >= 1600,
        progress: Math.min(100, Math.max(0, ((player.rating - 1200) / 400) * 100)),
      },
    ];

    for (const ev of evaluations) {
      const def = ACHIEVEMENTS_CATALOG.find((c) => c.key === ev.key);
      if (!def) continue;

      const record = existingMap.get(ev.key);

      if (!record) {
        await ctx.db.insert("playerAchievements", {
          playerId: player._id,
          achievementKey: ev.key,
          title: def.title,
          description: def.description,
          category: def.category,
          badgeIcon: def.badgeIcon,
          progress: Math.round(ev.progress),
          isUnlocked: ev.unlocked,
          unlockedAt: ev.unlocked ? now : undefined,
          createdAt: now,
        });

        if (ev.unlocked) {
          newlyUnlocked.push(def);
        }
      } else if (!record.isUnlocked && ev.unlocked) {
        await ctx.db.patch(record._id, {
          isUnlocked: true,
          unlockedAt: now,
          progress: 100,
        });
        newlyUnlocked.push(def);
      } else if (!record.isUnlocked && Math.round(ev.progress) !== record.progress) {
        await ctx.db.patch(record._id, {
          progress: Math.round(ev.progress),
        });
      }
    }

    return { newlyUnlocked };
  },
});

export const triggerCustomAchievement = mutation({
  args: { achievementKey: v.string() },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const def = ACHIEVEMENTS_CATALOG.find((c) => c.key === args.achievementKey);
    if (!def) return { unlocked: false };

    const record = await ctx.db
      .query("playerAchievements")
      .withIndex("by_playerId_and_achievementKey", (q) =>
        q.eq("playerId", player._id).eq("achievementKey", args.achievementKey)
      )
      .first();

    const now = Date.now();
    if (!record) {
      await ctx.db.insert("playerAchievements", {
        playerId: player._id,
        achievementKey: args.achievementKey,
        title: def.title,
        description: def.description,
        category: def.category,
        badgeIcon: def.badgeIcon,
        progress: 100,
        isUnlocked: true,
        unlockedAt: now,
        createdAt: now,
      });
      return { unlocked: true, title: def.title };
    }

    if (!record.isUnlocked) {
      await ctx.db.patch(record._id, {
        isUnlocked: true,
        unlockedAt: now,
        progress: 100,
      });
      return { unlocked: true, title: def.title };
    }

    return { unlocked: false };
  },
});
