// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { PlayerDetailDrawer } from "../player-detail-drawer";
import { TransactionDetailDrawer } from "../transaction-detail-drawer";
import type { Id } from "../../../../../convex/_generated/dataModel";

const mockGetPlayerDetails = vi.hoisted(() => vi.fn());
const mockSetRestrictions = vi.hoisted(() => vi.fn());
const mockTakeFairPlayAction = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: (_fn: any) => {
    return (_args: any) => mockSetRestrictions(_args);
  },
  useQuery: (_fn: any, args: any) => {
    if (args && args.playerId) {
      return mockGetPlayerDetails(args);
    }
    return null;
  },
  useConvexAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const samplePlayerDetails = {
  profile: {
    avatar: "https://example.com/avatar.png",
    username: "alemu_petros",
    displayName: "Alemu Petros",
    email: "alemu@castle.et",
    clerkId: "user_clerk_alemu_12345",
    memberSince: 1700000000000,
    lastSeen: 1700050000000,
    isOnline: true,
    accountStatus: "active" as const,
  },
  wallet: {
    availableBalance: 250000, // 2,500.00 ETB
    lockedBalance: 50000,     // 500.00 ETB
    totalDeposited: 1000000,  // 10,000.00 ETB
    totalWithdrawn: 700000,   // 7,000.00 ETB
    gamingProfit: 30000,      // 300.00 ETB
    status: "active",
    depositsRestricted: false,
    stakingRestricted: false,
    withdrawalsRestricted: false,
    freezeReason: null,
    recentTransactions: [
      {
        _id: "tx_mock_1",
        entryType: "credit",
        amountSantims: 50000,
        amountEtb: 500,
        referenceType: "deposit",
        referenceId: "dep_chapa_999",
        description: "Deposit via Chapa Telebirr",
        createdAt: 1700020000000,
      },
      {
        _id: "tx_mock_2",
        entryType: "debit",
        amountSantims: 20000,
        amountEtb: 200,
        referenceType: "withdrawal",
        referenceId: "wdr_telebirr_111",
        description: "Withdrawal to Telebirr",
        createdAt: 1700030000000,
      },
    ],
  },
  fairPlay: {
    suspicionScore: 12,
    flagsCount: 0,
    isBanned: false,
    warningMessage: null,
    reportsAgainst: 0,
    telemetry: {
      tabBlurCount: 1,
      blursPerMove: 0.05,
      avgMoveTimeMs: 2400,
      moveTimeVariance: 1850,
      acpl: 32,
      top1MatchRate: 45,
    },
    reports: [],
    previousSanctions: [],
  },
  auditHistory: [
    {
      _id: "audit_log_1",
      adminId: "admin_staff_999",
      action: "wallet_restrictions_update",
      reason: "Quarterly risk assessment and account review",
      amountSantims: 0,
      metadata: JSON.stringify({
        depositsRestricted: false,
        stakingRestricted: false,
        withdrawalsRestricted: false,
        freezeEntireWallet: false,
        adminClerkId: "clerk_admin_chief",
      }),
      createdAt: 1700040000000,
    },
  ],
};

beforeEach(() => {
  mockGetPlayerDetails.mockReset().mockReturnValue(samplePlayerDetails);
  mockSetRestrictions.mockReset();
  mockTakeFairPlayAction.mockReset();
});

describe("PlayerDetailDrawer Component", () => {
  const dummyPlayerId = "player_test_alemu_123" as unknown as Id<"players">;

  it("renders the 4 navigation tabs inside the drawer", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Tab 1: Profile & Account
    expect(markup).toContain("Profile &amp; Account");
    // Tab 2: Wallet & Ledger
    expect(markup).toContain("Wallet &amp; Ledger");
    // Tab 3: Fair Play
    expect(markup).toContain("Fair Play");
    // Tab 4: Admin Audit History
    expect(markup).toContain("Admin Audit History");
  });

  it("strictly enforces ZERO university/campus terms in the rendered output across all tabs", () => {
    const tabs = ["profile", "wallet", "fairplay", "audit"] as const;
    for (const tab of tabs) {
      const markup = renderToStaticMarkup(
        <PlayerDetailDrawer
          playerId={dummyPlayerId}
          isOpen={true}
          onClose={() => {}}
          initialTab={tab}
        />
      );

      const lower = markup.toLowerCase();
      expect(lower).not.toContain("university");
      expect(lower).not.toContain("campus");
      expect(lower).not.toContain("studentid");
      expect(lower).not.toContain("student id");
      expect(lower).not.toContain("college");
      expect(lower).not.toContain("faculty");
    }
  });

  it("renders profile identity information and online status", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
        initialTab="profile"
      />
    );

    expect(markup).toContain("Alemu Petros");
    expect(markup).toContain("@alemu_petros");
    expect(markup).toContain("alemu@castle.et");
    expect(markup).toContain("user_clerk_alemu_12345");
    expect(markup).toContain("Verified Player");
    expect(markup).toContain("Online");
    expect(markup).toContain("active");
  });

  it("renders all wallet ledger balances formatted in ETB with font-mono tabular-nums", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
        initialTab="wallet"
      />
    );

    // Balances
    expect(markup).toContain("Available Balance");
    expect(markup).toContain("2,500.00");
    expect(markup).toContain("Locked Balance");
    expect(markup).toContain("500.00");
    expect(markup).toContain("Total Deposited");
    expect(markup).toContain("10,000.00");
    expect(markup).toContain("Total Withdrawn");
    expect(markup).toContain("7,000.00");
    expect(markup).toContain("Net Gaming Profit");
    expect(markup).toContain("+300.00");

    // All balances formatted with ETB currency suffix
    expect(markup).toContain("ETB");
    expect(markup).toContain("font-mono");
    expect(markup).toContain("tabular-nums");

    // Mini transaction history
    expect(markup).toContain("Recent Ledger Activity");
    expect(markup).toContain("Deposit via Chapa Telebirr");
    expect(markup).toContain("+500.00 ETB");
    expect(markup).toContain("Withdrawal to Telebirr");
    expect(markup).toContain("-200.00 ETB");
  });

  it("requires a non-empty audit reason to submit wallet restrictions", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
        initialTab="wallet"
      />
    );

    // Check restriction controls exist
    expect(markup).toContain("Targeted Wallet Security &amp; Freeze Controls");
    expect(markup).toContain("Deposits");
    expect(markup).toContain("Staking");
    expect(markup).toContain("Withdrawals");
    expect(markup).toContain("Freeze Entire Wallet");

    // Check mandatory audit reason input and helper text
    expect(markup).toContain("Audit Reason");
    expect(markup).toContain("A valid audit reason is required before changes can be submitted.");

    // Check button disabled when reason is empty
    expect(markup).toContain("Save Restrictions");
    expect(markup).toContain("cursor-not-allowed");
  });

  it("renders Fair Play telemetry, suspicion score, and administrative sanction actions", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
        initialTab="fairplay"
      />
    );

    expect(markup).toContain("Anti-Cheat Status &amp; Suspicion");
    expect(markup).toContain("12 / 100");
    expect(markup).toContain("Reports Filed Against");
    expect(markup).toContain("Biometric &amp; Engine Telemetry");
    expect(markup).toContain("0.05");
    expect(markup).toContain("32 ACPL");
    expect(markup).toContain("1850 ms");
    expect(markup).toContain("Warn Player");
    expect(markup).toContain("Ban Account");
  });

  it("renders Admin Audit History chronological timeline with reason and staff identifiers", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={true}
        onClose={() => {}}
        initialTab="audit"
      />
    );

    expect(markup).toContain("Chronological Administrative Log");
    expect(markup).toContain("wallet restrictions update");
    expect(markup).toContain("Quarterly risk assessment and account review");
    expect(markup).toContain("Staff ID: admin_staf");
    expect(markup).toContain("Clerk: clerk_admin_");
  });

  it("does not render when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <PlayerDetailDrawer
        playerId={dummyPlayerId}
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(markup).toBe("");
  });
});

describe("TransactionDetailDrawer Component", () => {
  const sampleTx = {
    id: "tx_ledger_1001",
    entryType: "credit",
    type: "deposit",
    amountEtb: 1500,
    feeEtb: 39,
    netEtb: 1461,
    status: "Completed",
    reference: "chapa_tx_ref_abc123",
    providerRef: "chapa_gateway_ref_789",
    idempotencyKey: "idem_key_deposit_555",
    method: "Telebirr",
    description: "Deposit via Telebirr gateway",
    username: "alemu_petros",
    userId: "player_alemu_id",
    timestamp: 1700000000000,
  };

  it("renders structured receipt with ETB amounts, fees, and identifiers", () => {
    const markup = renderToStaticMarkup(
      <TransactionDetailDrawer
        transaction={sampleTx}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Title & Type
    expect(markup).toContain("Transaction Receipt");
    expect(markup).toContain("deposit");
    // ETB amounts in font-mono
    expect(markup).toContain("1,500.00");
    expect(markup).toContain("ETB");
    expect(markup).toContain("-39.00 ETB");
    expect(markup).toContain("+1,461.00");
    // References
    expect(markup).toContain("chapa_tx_ref_abc123");
    expect(markup).toContain("chapa_gateway_ref_789");
    expect(markup).toContain("idem_key_deposit_555");
    // Player Context
    expect(markup).toContain("alemu_petros");
    expect(markup).toContain("Telebirr");
    expect(markup).toContain("font-mono");
    expect(markup).toContain("tabular-nums");
  });

  it("strictly omits university/campus references from transaction receipt", () => {
    const markup = renderToStaticMarkup(
      <TransactionDetailDrawer
        transaction={sampleTx}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const lower = markup.toLowerCase();
    expect(lower).not.toContain("university");
    expect(lower).not.toContain("campus");
    expect(lower).not.toContain("studentid");
    expect(lower).not.toContain("college");
  });
});
