// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getFunctionName } from "convex/server";
import { AdminView } from "../admin-view";

const mockIsAdmin = vi.hoisted(() => vi.fn());
const mockKpis = vi.hoisted(() => vi.fn());
const mockTransactions = vi.hoisted(() => vi.fn());
const mockActivity = vi.hoisted(() => vi.fn());
const mockHealth = vi.hoisted(() => vi.fn());
const mockFeedback = vi.hoisted(() => vi.fn());
const mockPendingDeposits = vi.hoisted(() => vi.fn());
const mockPendingWithdrawals = vi.hoisted(() => vi.fn());
const mockMatches = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (queryFn: any) => {
    try {
      const name = getFunctionName(queryFn);
      if (name === "admin:isAdmin") return mockIsAdmin();
      if (name === "admin:getPlatformKpis" || name === "admin:platformStats") return mockKpis();
      if (name === "admin:getUnifiedTransactions") return mockTransactions();
      if (name === "admin:getRecentActivity") return mockActivity();
      if (name === "admin:getSystemHealth") return mockHealth();
      if (name === "admin:getLiveMatchesAndTournaments") return mockMatches();
      if (name === "feedback:adminList") return mockFeedback();
      if (name === "deposits:pendingDeposits") return mockPendingDeposits();
      if (name === "withdrawals:pendingWithdrawals") return mockPendingWithdrawals();
      if (name === "admin:searchPlayers") return [];
      if (name === "admin:getPlayerDetails") return undefined;
    } catch {
      // fallback
    }
    return undefined;
  },
  useConvexAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

describe("Premium Abay Chess Admin Dashboard", () => {
  beforeEach(() => {
    mockIsAdmin.mockReturnValue(true);
    mockActivity.mockReturnValue([]);
    mockTransactions.mockReturnValue([]);
    mockFeedback.mockReturnValue([]);
    mockPendingDeposits.mockReturnValue([]);
    mockPendingWithdrawals.mockReturnValue([]);
    mockMatches.mockReturnValue({
      matches: [],
      tournaments: [],
      totalActiveMatches: 23,
      totalActiveTournaments: 4,
    });
    mockHealth.mockReturnValue({
      convex: "HEALTHY",
      chapa: "HEALTHY",
      auth: "HEALTHY",
      webhooks: "HEALTHY",
      database: "HEALTHY",
      cron: "HEALTHY",
      errorRate: "0.01%",
      latency: "142ms",
    });
    mockKpis.mockReturnValue({
      totalPlayers: 2847,
      onlineNow: 428,
      activeGames: 23,
      gamesToday: 340,
      platformBalance: 53737120,
      userLiabilities: 12429910,
      lockedEscrow: 5715220,
      pendingWithdrawalReserve: 4200,
      revenueToday: 3240,
      depositsToday: 2480,
      withdrawalsToday: 1260,
      grossDeposits: 11254160,
      grossWithdrawals: 514800,
      transactionFees: 1547600,
      platformCommission: 28410,
      playerLiabilities: 12429910,
      availablePlatformFunds: 18720840,
      lockedMatchFunds: 5715220,
      totalPlatformBalance: 53737120,
      totalPlatformRevenue: 389420,
      pendingActions: {
        pendingWithdrawals: 2,
        pendingDeposits: 1,
        failedPayments: 2,
        fairPlayReports: 3,
        userFeedback: 11,
        systemAlerts: 0,
        totalPending: 3,
      },
      chartData: [
        { date: "Oct 1", revenue: 14500, commission: 2800, deposits: 42000, withdrawals: 12000, games: 24, transactions: 35 },
        { date: "Oct 2", revenue: 19800, commission: 3400, deposits: 56000, withdrawals: 15000, games: 31, transactions: 44 },
      ],
      trends: {
        totalPlayers: "+12.3%",
        onlineNow: "+18.2%",
        activeGames: "+1.1%",
        platformBalance: "+4.2%",
        lockedEscrow: "+23.4%",
        revenueToday: "+12.8%",
        depositsToday: "+18.7%",
        withdrawalsToday: "-4.3%",
        commission: "+15.2%",
        pendingActions: "+25.0%",
      },
    });
  });

  it("renders the top horizontal navigation bar with Abay Chess branding and sections", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("ABAY");
    expect(html).toContain("CHESS");
    expect(html).toContain("ADMIN");
    expect(html).toContain("Overview");
    expect(html).toContain("Financials");
    expect(html).toContain("Transactions");
    expect(html).toContain("Users");
    expect(html).toContain("Matches");
    expect(html).toContain("Feedback");
    expect(html).toContain("System Health");
    expect(html).toContain("Audit Logs");
  });

  it("renders all six KPI cards matching the reference design", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Total Platform Revenue");
    expect(html).toContain("Platform Commission");
    expect(html).toContain("Total Deposits");
    expect(html).toContain("Total Withdrawals");
    expect(html).toContain("Active Players");
    expect(html).toContain("Pending Actions");
    expect(html).toContain("ETB");
  });

  it("renders Revenue Overview and Financial Summary", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Revenue Overview");
    expect(html).toContain("Financial Summary");
    expect(html).toContain("Gross Deposits");
    expect(html).toContain("Gross Withdrawals");
    expect(html).toContain("Transaction Fees");
    expect(html).toContain("Platform Commission");
    expect(html).toContain("Player Liabilities");
    expect(html).toContain("Available Platform Funds");
    expect(html).toContain("Locked Match Funds");
    expect(html).toContain("Total Platform Balance");
  });

  it("renders Recent Transactions and Quick Actions", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Recent Transactions");
    expect(html).toContain("Quick Actions");
    expect(html).toContain("Pending Withdrawals");
    expect(html).toContain("Pending Deposits");
    expect(html).toContain("Failed Payments");
    expect(html).toContain("User Feedback");
    expect(html).toContain("System Alerts");
  });

  it("renders Active Matches, Tournaments, and System Health", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Active Matches &amp; Tournaments");
    expect(html).toContain("Live Matches");
    expect(html).toContain("Ongoing Tournaments");
    expect(html).toContain("Recent Activity");
    expect(html).toContain("System Health");
    expect(html).toContain("Convex");
    expect(html).toContain("Chapa");
    expect(html).toContain("Clerk");
  });

  it("strictly omits any university or campus concepts", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html.toLowerCase()).not.toContain("university");
    expect(html.toLowerCase()).not.toContain("campus");
    expect(html.toLowerCase()).not.toContain("student id");
  });
});
