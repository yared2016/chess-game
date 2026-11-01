// convex/financial/tariffs.ts
// Dynamic Versioned Provider Tariff Engine for Abay Chess v4.2.7-PROD
// Enforces official verified tariffs, boundary quarantines (OD-05, OD-06), overlap prevention (RB-46), and zero markup.

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireOwner, requireAdmin, AnyCtx } from "../lib/auth";
import {
  vTariffRoute,
  vTariffPayer,
  type CanonicalAccountNumber,
} from "./validators";

export type TariffRoute = "telebirr_p2p" | "cbe_a2a" | "cbe_to_telebirr";

export interface TariffFeeCalculation {
  status: "active" | "quarantined";
  feeSantims: bigint;
  tariffId: string;
  version: number;
  route: TariffRoute;
  isAutomatedPayoutAllowed: boolean;
  quarantineReason?: string;
  effectiveBps: number;
  effectiveFixedSantims: bigint;
}

/**
 * Calculates provider fee for a given route and amount, strictly applying
 * official tariffs and quarantines.
 */
export async function calculateTariffFee(
  ctx: AnyCtx,
  args: {
    route: TariffRoute;
    amountSantims: bigint;
    asOf?: number;
  }
): Promise<TariffFeeCalculation> {
  const { route, amountSantims } = args;
  const now = args.asOf ?? Date.now();

  // 1. Minimum sanity check
  if (amountSantims <= BigInt(0)) {
    throw new Error(`ERR_INVALID_AMOUNT: Amount must be greater than 0 santims.`);
  }

  // 2. OD-06 / RB-46.2: Telebirr 100.00–100.99 ETB (10,000–10,099 santims) Boundary Quarantine
  if (route === "telebirr_p2p" && amountSantims >= BigInt(10000) && amountSantims <= BigInt(10099)) {
    return {
      status: "quarantined",
      feeSantims: BigInt(500), // Quote Band 2 fee (5.00 ETB) as protective reservation
      tariffId: "telebirr_p2p_boundary_quarantine",
      version: 1,
      route: "telebirr_p2p",
      isAutomatedPayoutAllowed: false,
      quarantineReason: "UNRESOLVED_BOUNDARY_QUARANTINED",
      effectiveBps: 0,
      effectiveFixedSantims: BigInt(500),
    };
  }

  // 3. OD-05 / RB-46.1: CBE Account-to-Account Band 1 (0.575 ETB / 1–1,000 ETB) Fractional Santim Quarantine
  if (route === "cbe_a2a" && amountSantims >= BigInt(100) && amountSantims <= BigInt(100000)) {
    return {
      status: "quarantined",
      feeSantims: BigInt(58), // Rounded 57.5 to 58 santims, but automated execution blocked
      tariffId: "cbe_a2a_band1_quarantine",
      version: 1,
      route: "cbe_a2a",
      isAutomatedPayoutAllowed: false,
      quarantineReason: "FRACTIONAL_SANTIM_QUARANTINED",
      effectiveBps: 0,
      effectiveFixedSantims: BigInt(58),
    };
  }

  // 4. Query active tariffs from database
  const matchingTariffs = await ctx.db
    .query("providerTariffs")
    .withIndex("by_route_and_effectiveFrom", (q) =>
      q.eq("route", route).lte("effectiveFrom", now)
    )
    .collect();

  // Filter tariffs that are currently active and encompass the amount
  const activeTariff = matchingTariffs.find((t) => {
    const isDateActive = t.effectiveTo === undefined || t.effectiveTo === null || t.effectiveTo >= now;
    const isAmountMatch = amountSantims >= t.minAmountSantims && amountSantims <= t.maxAmountSantims;
    return isDateActive && isAmountMatch;
  });

  if (!activeTariff) {
    // If database table is not yet seeded, use official verified fallback schedules
    return getFallbackVerifiedTariff(route, amountSantims);
  }

  // Compute fee: fixedFeeSantims + (amountSantims * BigInt(rateBasisPoints)) / 10000n
  const variableFee = (amountSantims * BigInt(activeTariff.rateBasisPoints)) / BigInt(10000);
  const totalFee = activeTariff.fixedFeeSantims + variableFee;

  return {
    status: activeTariff.isQuarantined ? "quarantined" : "active",
    feeSantims: totalFee,
    tariffId: activeTariff.tariffId,
    version: activeTariff.version,
    route,
    isAutomatedPayoutAllowed: !activeTariff.isQuarantined,
    quarantineReason: activeTariff.quarantineReason,
    effectiveBps: activeTariff.rateBasisPoints,
    effectiveFixedSantims: activeTariff.fixedFeeSantims,
  };
}

/**
 * Hardcoded official verified fallback schedules used if database tariffs
 * have not yet been seeded.
 */
function getFallbackVerifiedTariff(
  route: TariffRoute,
  amountSantims: bigint
): TariffFeeCalculation {
  if (route === "telebirr_p2p") {
    // Verified Telebirr P2P schedule:
    // Band 1: 1–100 ETB (100–10,000 santims) -> Free (0 santims)
    if (amountSantims < BigInt(10000)) {
      return {
        status: "active",
        feeSantims: BigInt(0),
        tariffId: "telebirr_p2p_v1_b1",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(0),
      };
    }
    // Band 2: 101–500 ETB (10,100–50,000 santims) -> 5.00 ETB (500 santims)
    if (amountSantims <= BigInt(50000)) {
      return {
        status: "active",
        feeSantims: BigInt(500),
        tariffId: "telebirr_p2p_v1_b2",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(500),
      };
    }
    // Band 3: 501–1,000 ETB (50,100–100,000 santims) -> 7.00 ETB (700 santims)
    if (amountSantims <= BigInt(100000)) {
      return {
        status: "active",
        feeSantims: BigInt(700),
        tariffId: "telebirr_p2p_v1_b3",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(700),
      };
    }
    // Band 4: 1,001–3,000 ETB (100,100–300,000 santims) -> 9.00 ETB (900 santims)
    if (amountSantims <= BigInt(300000)) {
      return {
        status: "active",
        feeSantims: BigInt(900),
        tariffId: "telebirr_p2p_v1_b4",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(900),
      };
    }
    // Band 5: 3,001–10,000 ETB (300,100–1,000,000 santims) -> 10.00 ETB (1,000 santims)
    if (amountSantims <= BigInt(1000000)) {
      return {
        status: "active",
        feeSantims: BigInt(1000),
        tariffId: "telebirr_p2p_v1_b5",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(1000),
      };
    }
  } else if (route === "cbe_a2a") {
    // Official CBE Account-to-Account schedule:
    // Band 2: 1,001–5,000 ETB (100,100–500,000 santims) -> 1.15 ETB (115 santims)
    if (amountSantims <= BigInt(500000)) {
      return {
        status: "active",
        feeSantims: BigInt(115),
        tariffId: "cbe_a2a_v1_b2",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(115),
      };
    }
    // Band 3: 5,001–10,000 ETB (500,100–1,000,000 santims) -> 2.30 ETB (230 santims)
    if (amountSantims <= BigInt(1000000)) {
      return {
        status: "active",
        feeSantims: BigInt(230),
        tariffId: "cbe_a2a_v1_b3",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(230),
      };
    }
    // Band 4: 10,001–50,000 ETB (1,000,100–5,000,000 santims) -> 3.45 ETB (345 santims)
    if (amountSantims <= BigInt(5000000)) {
      return {
        status: "active",
        feeSantims: BigInt(345),
        tariffId: "cbe_a2a_v1_b4",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(345),
      };
    }
    // Band 5: 50,001–100,000 ETB (5,000,100–10,000,000 santims) -> 5.75 ETB (575 santims)
    if (amountSantims <= BigInt(10000000)) {
      return {
        status: "active",
        feeSantims: BigInt(575),
        tariffId: "cbe_a2a_v1_b5",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(575),
      };
    }
  } else if (route === "cbe_to_telebirr") {
    // Official CBE to Telebirr Wallet schedule:
    // Band 1: 1–5,000 ETB (100–500,000 santims) -> 11.50 ETB (1,150 santims)
    if (amountSantims <= BigInt(500000)) {
      return {
        status: "active",
        feeSantims: BigInt(1150),
        tariffId: "cbe_to_telebirr_v1_b1",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(1150),
      };
    }
    // Band 2: 5,001–10,000 ETB (500,100–1,000,000 santims) -> 17.25 ETB (1,725 santims)
    if (amountSantims <= BigInt(1000000)) {
      return {
        status: "active",
        feeSantims: BigInt(1725),
        tariffId: "cbe_to_telebirr_v1_b2",
        version: 1,
        route,
        isAutomatedPayoutAllowed: true,
        effectiveBps: 0,
        effectiveFixedSantims: BigInt(1725),
      };
    }
  }

  throw new Error(`ERR_NO_ACTIVE_TARIFF_FOUND: No verified tariff schedule for ${route} at ${amountSantims} santims.`);
}

/**
 * Upserts a provider tariff into providerTariffs, enforcing the non-overlapping
 * interval database invariant (RB-46, RB-70).
 */
export const upsertProviderTariff = mutation({
  args: {
    tariffId: v.string(),
    route: vTariffRoute,
    version: v.number(),
    minAmountSantims: v.int64(),
    maxAmountSantims: v.int64(),
    fixedFeeSantims: v.int64(),
    rateBasisPoints: v.number(),
    payer: vTariffPayer,
    vatRateBasisPoints: v.number(),
    vatIncluded: v.boolean(),
    isQuarantined: v.boolean(),
    quarantineReason: v.optional(v.string()),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    verifiedSourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);

    if (args.minAmountSantims > args.maxAmountSantims) {
      throw new Error(`ERR_INVALID_AMOUNT_INTERVAL: minAmountSantims cannot exceed maxAmountSantims.`);
    }

    // Overlap validation invariant (RB-46 / RB-70)
    const existingForRoute = await ctx.db
      .query("providerTariffs")
      .withIndex("by_route_and_effectiveFrom", (q) => q.eq("route", args.route))
      .collect();

    for (const other of existingForRoute) {
      if (other.tariffId === args.tariffId) continue;

      const thisEnd = args.effectiveTo ?? Number.MAX_SAFE_INTEGER;
      const otherEnd = other.effectiveTo ?? Number.MAX_SAFE_INTEGER;

      // Check date range overlap
      const datesOverlap = args.effectiveFrom <= otherEnd && thisEnd >= other.effectiveFrom;

      if (datesOverlap) {
        // Check amount interval overlap: max(minA, minB) <= min(maxA, maxB)
        const overlapStart = args.minAmountSantims > other.minAmountSantims ? args.minAmountSantims : other.minAmountSantims;
        const overlapEnd = args.maxAmountSantims < other.maxAmountSantims ? args.maxAmountSantims : other.maxAmountSantims;

        if (overlapStart <= overlapEnd) {
          throw new Error(
            `ERR_TARIFF_OVERLAP_DETECTED: New tariff interval [${args.minAmountSantims}, ${args.maxAmountSantims}] overlaps with existing active tariff "${other.tariffId}" [${other.minAmountSantims}, ${other.maxAmountSantims}] for route ${args.route}.`
          );
        }
      }
    }

    const existingDoc = await ctx.db
      .query("providerTariffs")
      .withIndex("by_tariffId", (q) => q.eq("tariffId", args.tariffId))
      .unique();

    if (existingDoc) {
      await ctx.db.patch(existingDoc._id, args);
      return { status: "updated", tariffId: args.tariffId };
    } else {
      await ctx.db.insert("providerTariffs", args);
      return { status: "created", tariffId: args.tariffId };
    }
  },
});

/** Seed all official verified provider tariffs into providerTariffs table. */
export const seedProviderTariffs = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const now = Date.now();

    const tariffsToSeed = [
      // Telebirr P2P Schedule
      {
        tariffId: "telebirr_p2p_v1_b1",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(100), // 1.00 ETB
        maxAmountSantims: BigInt(9999), // 99.99 ETB
        fixedFeeSantims: BigInt(0),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },
      {
        tariffId: "telebirr_p2p_v1_b1_quarantine",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(10000), // 100.00 ETB
        maxAmountSantims: BigInt(10099), // 100.99 ETB
        fixedFeeSantims: BigInt(500),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: true,
        quarantineReason: "UNRESOLVED_BOUNDARY_QUARANTINED",
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },
      {
        tariffId: "telebirr_p2p_v1_b2",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(10100), // 101.00 ETB
        maxAmountSantims: BigInt(50000), // 500.00 ETB
        fixedFeeSantims: BigInt(500),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },
      {
        tariffId: "telebirr_p2p_v1_b3",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(50001), // 500.01 ETB
        maxAmountSantims: BigInt(100000), // 1,000.00 ETB
        fixedFeeSantims: BigInt(700),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },
      {
        tariffId: "telebirr_p2p_v1_b4",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(100001), // 1,000.01 ETB
        maxAmountSantims: BigInt(300000), // 3,000.00 ETB
        fixedFeeSantims: BigInt(900),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },
      {
        tariffId: "telebirr_p2p_v1_b5",
        route: "telebirr_p2p" as const,
        version: 1,
        minAmountSantims: BigInt(300001), // 3,000.01 ETB
        maxAmountSantims: BigInt(1000000), // 10,000.00 ETB
        fixedFeeSantims: BigInt(1000),
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.ethiotelecom.et/telebirr-tariffs/",
      },

      // CBE Account-to-Account Schedule
      {
        tariffId: "cbe_a2a_v1_b1_quarantine",
        route: "cbe_a2a" as const,
        version: 1,
        minAmountSantims: BigInt(100), // 1.00 ETB
        maxAmountSantims: BigInt(100000), // 1,000.00 ETB
        fixedFeeSantims: BigInt(58), // 0.575 ETB rounded
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: true,
        quarantineReason: "FRACTIONAL_SANTIM_QUARANTINED",
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
      {
        tariffId: "cbe_a2a_v1_b2",
        route: "cbe_a2a" as const,
        version: 1,
        minAmountSantims: BigInt(100001), // 1,000.01 ETB
        maxAmountSantims: BigInt(500000), // 5,000.00 ETB
        fixedFeeSantims: BigInt(115), // 1.15 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
      {
        tariffId: "cbe_a2a_v1_b3",
        route: "cbe_a2a" as const,
        version: 1,
        minAmountSantims: BigInt(500001), // 5,000.01 ETB
        maxAmountSantims: BigInt(1000000), // 10,000.00 ETB
        fixedFeeSantims: BigInt(230), // 2.30 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
      {
        tariffId: "cbe_a2a_v1_b4",
        route: "cbe_a2a" as const,
        version: 1,
        minAmountSantims: BigInt(1000001), // 10,000.01 ETB
        maxAmountSantims: BigInt(5000000), // 50,000.00 ETB
        fixedFeeSantims: BigInt(345), // 3.45 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
      {
        tariffId: "cbe_a2a_v1_b5",
        route: "cbe_a2a" as const,
        version: 1,
        minAmountSantims: BigInt(5000001), // 50,000.01 ETB
        maxAmountSantims: BigInt(10000000), // 100,000.00 ETB
        fixedFeeSantims: BigInt(575), // 5.75 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },

      // CBE to Telebirr Wallet Schedule
      {
        tariffId: "cbe_to_telebirr_v1_b1",
        route: "cbe_to_telebirr" as const,
        version: 1,
        minAmountSantims: BigInt(100), // 1.00 ETB
        maxAmountSantims: BigInt(500000), // 5,000.00 ETB
        fixedFeeSantims: BigInt(1150), // 11.50 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
      {
        tariffId: "cbe_to_telebirr_v1_b2",
        route: "cbe_to_telebirr" as const,
        version: 1,
        minAmountSantims: BigInt(500001), // 5,000.01 ETB
        maxAmountSantims: BigInt(1000000), // 10,000.00 ETB
        fixedFeeSantims: BigInt(1725), // 17.25 ETB
        rateBasisPoints: 0,
        payer: "sender" as const,
        vatRateBasisPoints: 1500,
        vatIncluded: true,
        isQuarantined: false,
        effectiveFrom: now,
        verifiedSourceUrl: "https://www.combanketh.et/en/terms-and-tariffs/",
      },
    ];

    let count = 0;
    for (const t of tariffsToSeed) {
      const existing = await ctx.db
        .query("providerTariffs")
        .withIndex("by_tariffId", (q) => q.eq("tariffId", t.tariffId))
        .unique();

      if (!existing) {
        await ctx.db.insert("providerTariffs", t);
        count++;
      }
    }

    return { totalSeeded: tariffsToSeed.length, newlyInserted: count };
  },
});

/** Query provider fee preview with breakdown. */
export const quoteProviderFee = query({
  args: {
    route: vTariffRoute,
    amountSantims: v.int64(),
  },
  handler: async (ctx, args) => {
    return await calculateTariffFee(ctx, args);
  },
});
