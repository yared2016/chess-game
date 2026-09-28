// convex/universities.ts
// Ethiopian Universities & Campus Leaderboards system.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalPlayer, requirePlayer } from "./lib/auth";

export const ETHIOPIAN_UNIVERSITIES_SEED = [
  {
    name: "Addis Ababa University",
    shortName: "AAU",
    city: "Addis Ababa",
    description: "The oldest and largest higher learning institution in Ethiopia.",
    initialPlayers: 18,
    initialRating: 1465,
    initialWins: 142,
    initialGames: 210,
  },
  {
    name: "Adama Science and Technology University",
    shortName: "ASTU",
    city: "Adama",
    description: "Center of excellence in STEM and technological innovation.",
    initialPlayers: 15,
    initialRating: 1480,
    initialWins: 130,
    initialGames: 195,
  },
  {
    name: "Addis Ababa Science and Technology University",
    shortName: "AASTU",
    city: "Addis Ababa",
    description: "Premier science and technology institution fostering engineering minds.",
    initialPlayers: 12,
    initialRating: 1440,
    initialWins: 98,
    initialGames: 160,
  },
  {
    name: "Jimma University",
    shortName: "JU",
    city: "Jimma",
    description: "We are in the community! Known for community-based education.",
    initialPlayers: 14,
    initialRating: 1415,
    initialWins: 94,
    initialGames: 155,
  },
  {
    name: "Hawassa University",
    shortName: "HU",
    city: "Hawassa",
    description: "Lakeside campus with a vibrant chess and sports culture.",
    initialPlayers: 11,
    initialRating: 1390,
    initialWins: 82,
    initialGames: 140,
  },
  {
    name: "Bahir Dar University",
    shortName: "BDU",
    city: "Bahir Dar",
    description: "Wisdom at the source of the Blue Nile.",
    initialPlayers: 13,
    initialRating: 1425,
    initialWins: 105,
    initialGames: 170,
  },
  {
    name: "University of Gondar",
    shortName: "UoG",
    city: "Gondar",
    description: "Historic medical and multidisciplinary university in the royal city.",
    initialPlayers: 9,
    initialRating: 1375,
    initialWins: 70,
    initialGames: 120,
  },
  {
    name: "Mekelle University",
    shortName: "MU",
    city: "Mekelle",
    description: "Excellence in dryland agriculture, engineering, and arts.",
    initialPlayers: 10,
    initialRating: 1400,
    initialWins: 76,
    initialGames: 135,
  },
  {
    name: "Haramaya University",
    shortName: "HRU",
    city: "Dire Dawa",
    description: "Pioneering agricultural and technological institution.",
    initialPlayers: 8,
    initialRating: 1360,
    initialWins: 60,
    initialGames: 110,
  },
  {
    name: "Arba Minch University",
    shortName: "AMU",
    city: "Arba Minch",
    description: "Renowned institute for water technology and natural sciences.",
    initialPlayers: 7,
    initialRating: 1350,
    initialWins: 52,
    initialGames: 98,
  },
];

export const listUniversities = query({
  args: {},
  handler: async (ctx) => {
    let list = await ctx.db.query("universities").collect();

    if (list.length === 0) {
      // Return static projection when not yet seeded
      return ETHIOPIAN_UNIVERSITIES_SEED.map((u, idx) => ({
        _id: `seed_${u.shortName}` as any,
        name: u.name,
        shortName: u.shortName,
        city: u.city,
        description: u.description,
        totalPlayers: u.initialPlayers,
        averageRating: u.initialRating,
        totalWins: u.initialWins,
        totalGames: u.initialGames,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }

    return list.sort((a, b) => b.averageRating - a.averageRating);
  },
});

export const getUniversity = query({
  args: { universityId: v.id("universities") },
  handler: async (ctx, args) => {
    const uni = await ctx.db.get("universities", args.universityId);
    if (!uni) return null;

    // Get top student players affiliated with this campus
    const players = await ctx.db.query("players").collect();
    const students = players
      .filter((p) => p.universityId === args.universityId)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map((p) => ({
        _id: p._id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        rating: p.rating,
        wins: p.wins,
      }));

    return {
      university: uni,
      students,
    };
  },
});

export const getMyUniversity = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player || !player.universityId) return null;
    return await ctx.db.get("universities", player.universityId);
  },
});

export const seedUniversities = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("universities").first();
    if (existing) return { count: 0, message: "Already seeded" };

    const now = Date.now();
    for (const u of ETHIOPIAN_UNIVERSITIES_SEED) {
      await ctx.db.insert("universities", {
        name: u.name,
        shortName: u.shortName,
        city: u.city,
        description: u.description,
        totalPlayers: u.initialPlayers,
        averageRating: u.initialRating,
        totalWins: u.initialWins,
        totalGames: u.initialGames,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { count: ETHIOPIAN_UNIVERSITIES_SEED.length, message: "Universities seeded successfully" };
  },
});

export const joinUniversity = mutation({
  args: { universityId: v.id("universities") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const uni = await ctx.db.get("universities", args.universityId);
    if (!uni) throw new Error("university-not-found");

    const prevUniId = player.universityId;

    // If changing university, decrement previous
    if (prevUniId && prevUniId !== args.universityId) {
      const prevUni = await ctx.db.get("universities", prevUniId);
      if (prevUni) {
        await ctx.db.patch(prevUni._id, {
          totalPlayers: Math.max(0, prevUni.totalPlayers - 1),
          updatedAt: Date.now(),
        });
      }
    }

    // Update player
    await ctx.db.patch(player._id, {
      universityId: uni._id,
      universityName: uni.name,
      updatedAt: Date.now(),
    });

    // Update new university stats
    if (prevUniId !== args.universityId) {
      const newTotalPlayers = uni.totalPlayers + 1;
      const newAverageRating = Math.round(
        (uni.averageRating * uni.totalPlayers + player.rating) / newTotalPlayers
      );

      await ctx.db.patch(uni._id, {
        totalPlayers: newTotalPlayers,
        averageRating: newAverageRating,
        totalWins: uni.totalWins + player.wins,
        updatedAt: Date.now(),
      });
    }

    return { success: true, universityName: uni.name, shortName: uni.shortName };
  },
});

export const leaveUniversity = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    if (!player.universityId) return { success: true };

    const uni = await ctx.db.get("universities", player.universityId);
    if (uni) {
      await ctx.db.patch(uni._id, {
        totalPlayers: Math.max(0, uni.totalPlayers - 1),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(player._id, {
      universityId: undefined,
      universityName: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
