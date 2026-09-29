// convex/financial/reconciliation.ts — Automated reconciliation for stuck withdrawals
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { postLedgerEntry } from "../ledger";
import { createNotification } from "../notifications";

/**
 * Sweeps all pending/reserved withdrawals and reconciles them.
 * Run automatically every minute by convex/crons.ts.
 */
export const reconcilePendingWithdrawals = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch stuck/pending withdrawals via internal query
    const pending = await ctx.runQuery(internal.financial.reconciliation.getPendingForReconciliation, {});
    const now = Date.now();
    const chapaSecretKey =
      process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";
    const isTestMode =
      process.env.CHAPA_MODE === "test" ||
      chapaSecretKey.startsWith("CHASECK_TEST-");

    for (const wdr of pending) {
      const ageMs = now - wdr.createdAt;

      // Case A: Stuck in "reserved" without providerTransferId for > 5 minutes
      // (means API process crashed or disconnected before Chapa call)
      if (wdr.status === "reserved" && !wdr.providerTransferId && ageMs > 5 * 60 * 1000) {
        console.log(`[Reconciliation] Auto-releasing orphan reservation: ${wdr.internalTransferRef}`);
        await ctx.runMutation(internal.financial.reconciliation.releaseStuckReservation, {
          internalTransferRef: wdr.internalTransferRef,
          reason: "Reservation timed out before provider transfer was registered. Funds restored.",
        });
        continue;
      }

      // Case B: In "processing" or "reserved" with providerTransferId
      if (ageMs > 30 * 1000) {
        try {
          const res = await fetch(`https://api.chapa.co/v1/transfers/verify/${encodeURIComponent(wdr.internalTransferRef)}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${chapaSecretKey}`,
              "Content-Type": "application/json",
            },
          });

          // Handle 404: Transfer not found at provider
          if (res.status === 404) {
            if (ageMs > 10 * 60 * 1000) {
              console.log(`[Reconciliation] Transfer not found on Chapa (404). Reversing: ${wdr.internalTransferRef}`);
              await ctx.runMutation(internal.financial.reconciliation.failWithdrawalInternal, {
                internalTransferRef: wdr.internalTransferRef,
                reason: "Transfer was not recognized by Chapa. Funds restored.",
              });
            }
            continue;
          }

          if (!res.ok) {
            continue;
          }

          const data = await res.json();

          // Sub-case B1: TEST MODE HANDLING
          // Chapa test mode verify returns: { message: "Transfer details (Test Mode)", status: "success", data: [null] }
          if (isTestMode || data.message?.includes("Test Mode")) {
            const isSimulatedFail =
              wdr.accountNumberMasked?.includes("fail") ||
              wdr.accountHolderName?.toLowerCase().includes("fail") ||
              wdr.accountNumberMasked?.endsWith("2233"); // 0900112233 is Chapa standard test fail account

            if (isSimulatedFail) {
              console.log(`[Reconciliation-TestMode] Simulating test failure for ${wdr.internalTransferRef}`);
              await ctx.runMutation(internal.financial.reconciliation.failWithdrawalInternal, {
                internalTransferRef: wdr.internalTransferRef,
                reason: "Simulated Test Mode Failure (test account). Funds restored.",
              });
            } else if (ageMs > 45 * 1000) {
              // Successfully queued test withdrawal: finalize after 45s grace period
              console.log(`[Reconciliation-TestMode] Finalizing test mode transfer: ${wdr.internalTransferRef}`);
              await ctx.runMutation(internal.financial.reconciliation.completeWithdrawalInternal, {
                internalTransferRef: wdr.internalTransferRef,
                providerTransferId: wdr.providerTransferId || wdr.internalTransferRef,
              });
            }
            continue;
          }

          // Sub-case B2: LIVE MODE HANDLING
          if (data && data.status === "success" && data.data) {
            const item = Array.isArray(data.data) ? data.data[0] : data.data;
            if (item) {
              const rawStatus = (item.status || "").toLowerCase();
              if (rawStatus === "success" || rawStatus === "completed") {
                console.log(`[Reconciliation] Finalizing completed withdrawal: ${wdr.internalTransferRef}`);
                await ctx.runMutation(internal.financial.reconciliation.completeWithdrawalInternal, {
                  internalTransferRef: wdr.internalTransferRef,
                  providerTransferId: item.id || wdr.providerTransferId,
                });
                continue;
              } else if (rawStatus === "failed" || rawStatus === "rejected") {
                console.log(`[Reconciliation] Reversing failed withdrawal: ${wdr.internalTransferRef}`);
                await ctx.runMutation(internal.financial.reconciliation.failWithdrawalInternal, {
                  internalTransferRef: wdr.internalTransferRef,
                  reason: data.message || "Provider transfer failed",
                });
                continue;
              }
            }
          }

          // Sub-case B3: Maximum Age Timeout (24 hours) for live processing withdrawals
          if (ageMs > 24 * 60 * 60 * 1000) {
            console.warn(`[Reconciliation] Withdrawal in processing >24h. Auto-failing: ${wdr.internalTransferRef}`);
            await ctx.runMutation(internal.financial.reconciliation.failWithdrawalInternal, {
              internalTransferRef: wdr.internalTransferRef,
              reason: "Withdrawal exceeded maximum 24h processing window without provider confirmation. Funds restored.",
            });
          }
        } catch (fetchErr) {
          console.warn(`[Reconciliation] Error verifying transfer ${wdr.internalTransferRef}:`, fetchErr);
        }
      }
    }
  },
});

/**
 * Internal query to fetch active withdrawals requiring reconciliation.
 */
export const getPendingForReconciliation = internalQuery({
  args: {},
  handler: async (ctx) => {
    const reserved = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status", (q) => q.eq("status", "reserved"))
      .take(20);

    const processing = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(20);

    return [...reserved, ...processing];
  },
});

export const completeWithdrawalInternal = internalMutation({
  args: {
    internalTransferRef: v.string(),
    providerTransferId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status === "completed") return;
    if (wdr.status === "reversed" || wdr.status === "failed") return;

    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);
    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);

    // 1. Post WITHDRAWAL_COMPLETE to immutable financial ledger
    await postLedgerEntry(ctx, {
      userId: wdr.userId,
      walletId: wallet._id,
      entryType: "withdrawal_complete",
      amountSantims: wdr.requestedAmountSantims,
      balanceAfterSantims: currentAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: wdr.internalTransferRef,
      idempotencyKey: `withdrawal_complete_${wdr.internalTransferRef}`,
      description: `Withdrawal transfer completed (${wdr.requestedAmountSantims / 100} ETB)`,
      now,
    });

    // 2. Post WITHDRAWAL_FEE if applicable
    if (wdr.providerFeeSantims > 0) {
      await postLedgerEntry(ctx, {
        userId: wdr.userId,
        walletId: wallet._id,
        entryType: "withdrawal_fee",
        amountSantims: wdr.providerFeeSantims,
        balanceAfterSantims: currentAvailableSantims,
        lockedAfterSantims: newLockedSantims,
        referenceType: "withdrawal",
        referenceId: wdr.internalTransferRef,
        idempotencyKey: `withdrawal_fee_${wdr.internalTransferRef}`,
        description: `Transfer fee for ${wdr.internalTransferRef}`,
        now,
      });
    }

    // 3. Patch wallet balances (decrease locked liability)
    await ctx.db.patch(wallet._id, {
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      totalWithdrawn: wallet.totalWithdrawn + wdr.requestedAmountSantims / 100,
      updatedAt: now,
    });

    // 4. Update withdrawal record
    await ctx.db.patch(wdr._id, {
      status: "completed",
      providerTransferId: args.providerTransferId ?? wdr.providerTransferId,
      completedAt: now,
      updatedAt: now,
    });

    // 5. Notify player
    await createNotification(ctx, {
      userId: wdr.userId,
      type: "withdrawal_completed",
      title: "Payout Sent! 🎉",
      message: `${(wdr.requestedAmountSantims / 100).toFixed(2)} ETB has been transferred to your ${wdr.bankName} account.`,
      link: "/wallet",
    });
  },
});

export const failWithdrawalInternal = internalMutation({
  args: {
    internalTransferRef: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status === "completed" || wdr.status === "failed" || wdr.status === "reversed") return;
    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);
    const newAvailableSantims = currentAvailableSantims + wdr.totalReservedSantims;

    // 1. Post compensating WITHDRAWAL_REVERSAL to ledger
    await postLedgerEntry(ctx, {
      userId: wdr.userId,
      walletId: wallet._id,
      entryType: "withdrawal_reversal",
      amountSantims: wdr.totalReservedSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: wdr.internalTransferRef,
      idempotencyKey: `withdrawal_reversal_${wdr.internalTransferRef}`,
      description: `Reversal of failed withdrawal (${wdr.totalReservedSantims / 100} ETB restored)`,
      now,
    });

    // 2. Patch wallet balances (locked -> available)
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    // 3. Mark withdrawal status as failed
    await ctx.db.patch(wdr._id, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: now,
    });

    // 4. Notify player
    await createNotification(ctx, {
      userId: wdr.userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Refunded ⚠️",
      message: `Your withdrawal of ${(wdr.requestedAmountSantims / 100).toFixed(2)} ETB could not be completed and ${wdr.totalReservedSantims / 100} ETB has been restored to your wallet.`,
      link: "/wallet",
    });
  },
});

export const releaseStuckReservation = internalMutation({
  args: {
    internalTransferRef: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status !== "reserved") return;
    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);
    const newAvailableSantims = currentAvailableSantims + wdr.totalReservedSantims;

    // 1. Post compensating WITHDRAWAL_REVERSAL to ledger
    await postLedgerEntry(ctx, {
      userId: wdr.userId,
      walletId: wallet._id,
      entryType: "withdrawal_reversal",
      amountSantims: wdr.totalReservedSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: wdr.internalTransferRef,
      idempotencyKey: `withdrawal_reversal_${wdr.internalTransferRef}`,
      description: `Release of expired reservation (${wdr.totalReservedSantims / 100} ETB restored)`,
      now,
    });

    // 2. Patch wallet balances (locked -> available)
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    // 3. Mark withdrawal as reversed
    await ctx.db.patch(wdr._id, {
      status: "reversed",
      failureReason: args.reason,
      updatedAt: now,
    });

    // 4. Notify player
    await createNotification(ctx, {
      userId: wdr.userId,
      type: "withdrawal_rejected",
      title: "Reservation Expired ⚠️",
      message: `Your reservation of ${(wdr.requestedAmountSantims / 100).toFixed(2)} ETB timed out and ${wdr.totalReservedSantims / 100} ETB has been restored to your wallet.`,
      link: "/wallet",
    });
  },
});

/**
 * Query pending deposits requiring automated reconciliation.
 */
export const getPendingDepositsForReconciliation = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("financialDeposits")
      .withIndex("by_status", (q) => q.eq("status", "pending_provider"))
      .take(20);
  },
});

/**
 * Internal mutation to credit a verified deposit from the reconciliation worker.
 */
export const creditDepositInternal = internalMutation({
  args: {
    internalTxRef: v.string(),
    providerTxId: v.string(),
    verifiedAmountSantims: v.number(),
    verifiedCurrency: v.string(),
  },
  handler: async (ctx, args) => {
    const deposit = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (!deposit || deposit.status === "credited") return;
    const now = Date.now();

    // Verify gross payment amount matches expected
    if (args.verifiedAmountSantims !== deposit.grossAmountSantims) {
      await ctx.db.patch(deposit._id, {
        status: "failed",
        failureReason: `Amount mismatch: expected ${deposit.grossAmountSantims}, got ${args.verifiedAmountSantims}`,
        updatedAt: now,
      });
      return;
    }

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet || wallet.status === "frozen") return;

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newAvailableSantims = currentAvailableSantims + deposit.requestedCreditSantims;

    // 1. Post DEPOSIT_CREDIT
    await postLedgerEntry(ctx, {
      userId: deposit.userId,
      walletId: wallet._id,
      entryType: "deposit_credit",
      amountSantims: deposit.requestedCreditSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: currentLockedSantims,
      referenceType: "deposit",
      referenceId: deposit.internalTxRef,
      idempotencyKey: `deposit_credit_${deposit.internalTxRef}`,
      description: `Deposit via ${deposit.provider.toUpperCase()} (${deposit.requestedCreditSantims / 100} ETB)`,
      now,
    });

    // 2. Post DEPOSIT_FEE if applicable
    if (deposit.providerFeeSantims > 0) {
      const feeRateStr = ((deposit.effectiveRateBps ?? 260) / 100).toFixed(1);
      await postLedgerEntry(ctx, {
        userId: deposit.userId,
        walletId: wallet._id,
        entryType: "deposit_fee",
        amountSantims: deposit.providerFeeSantims,
        balanceAfterSantims: newAvailableSantims,
        lockedAfterSantims: currentLockedSantims,
        referenceType: "deposit",
        referenceId: deposit.internalTxRef,
        idempotencyKey: `deposit_fee_${deposit.internalTxRef}`,
        description: `Chapa fee (${feeRateStr}% incl. VAT) for ${deposit.internalTxRef} (${deposit.providerFeeSantims / 100} ETB)`,
        now,
      });
    }

    // 3. Patch wallet balances
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      totalDeposited: wallet.totalDeposited + deposit.requestedCreditSantims / 100,
      updatedAt: now,
    });

    // 4. Update deposit status
    await ctx.db.patch(deposit._id, {
      status: "credited",
      providerTxId: args.providerTxId,
      verifiedAt: now,
      updatedAt: now,
    });

    // 5. Notify player
    await createNotification(ctx, {
      userId: deposit.userId,
      type: "chapa_payment_verified",
      title: "Deposit Credited! 💳",
      message: `${(deposit.requestedCreditSantims / 100).toFixed(2)} ETB has been credited to your chess wallet.`,
      link: "/wallet",
    });
  },
});

export const failDepositInternal = internalMutation({
  args: {
    internalTxRef: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const deposit = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (!deposit || deposit.status === "credited" || deposit.status === "failed") return;
    await ctx.db.patch(deposit._id, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Sweeps pending deposits, verifies their status against Chapa, and credits verified deposits automatically.
 * Run automatically every minute by convex/crons.ts.
 */
export const reconcilePendingDeposits = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.financial.reconciliation.getPendingDepositsForReconciliation, {});
    const now = Date.now();
    const chapaSecretKey =
      process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";

    for (const dep of pending) {
      const ageMs = now - dep.createdAt;
      // Allow 30 seconds for user to complete checkout before polling
      if (ageMs < 30 * 1000) continue;

      try {
        const res = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(dep.internalTxRef)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${chapaSecretKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          if (ageMs > 24 * 60 * 60 * 1000) {
            await ctx.runMutation(internal.financial.reconciliation.failDepositInternal, {
              internalTxRef: dep.internalTxRef,
              reason: "Deposit expired after 24h without provider confirmation.",
            });
          }
          continue;
        }

        const data = await res.json();
        if (data.status === "success" && data.data) {
          const rawStatus = (data.data.status || "").toLowerCase();
          if (rawStatus === "success") {
            const amountEtb =
              typeof data.data.amount === "string"
                ? parseFloat(data.data.amount)
                : Number(data.data.amount);
            const verifiedSantims = Math.round(amountEtb * 100);

            console.log(`[Reconciliation-Deposit] Auto-crediting verified deposit: ${dep.internalTxRef}`);
            await ctx.runMutation(internal.financial.reconciliation.creditDepositInternal, {
              internalTxRef: dep.internalTxRef,
              providerTxId: data.data.reference || dep.internalTxRef,
              verifiedAmountSantims: verifiedSantims,
              verifiedCurrency: data.data.currency || "ETB",
            });
          } else if (rawStatus === "failed" || rawStatus === "cancelled") {
            await ctx.runMutation(internal.financial.reconciliation.failDepositInternal, {
              internalTxRef: dep.internalTxRef,
              reason: `Provider reported status: ${rawStatus}`,
            });
          }
        }
      } catch (err) {
        console.warn(`[Reconciliation-Deposit] Error verifying deposit ${dep.internalTxRef}:`, err);
      }
    }
  },
});
