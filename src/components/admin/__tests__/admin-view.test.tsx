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

describe("AdminView Single-Page Control Center", () => {
  beforeEach(() => {
    mockIsAdmin.mockReturnValue(true);
    mockActivity.mockReturnValue([]);
    mockTransactions.mockReturnValue([]);
    mockFeedback.mockReturnValue([]);
    mockPendingDeposits.mockReturnValue([]);
    mockPendingWithdrawals.mockReturnValue([]);
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
      totalPlayers: 18742,
      onlineNow: 428,
      activeGames: 86,
      gamesToday: 340,
      platformBalance: 187420,
      userLiabilities: 45230,
      lockedEscrow: 12850,
      pendingWithdrawalReserve: 4200,
      revenueToday: 3240,
      depositsToday: 2480,
      withdrawalsToday: 1260,
      pendingActions: {
        pendingWithdrawals: 12,
        pendingDeposits: 4,
        failedPayments: 2,
        fairPlayReports: 3,
        userFeedback: 5,
        systemAlerts: 1,
      },
      chartData: [
        { date: "Day 1", revenue: 100, games: 10 },
        { date: "Day 2", revenue: 200, games: 20 },
      ],
      trends: {
        totalPlayers: "+12.5%",
        onlineNow: "+18.2%",
        activeGames: "+1.1%",
        platformBalance: "+4.2%",
        lockedEscrow: "+23.4%",
        revenueToday: "+32.9%",
        depositsToday: "+24.2%",
        withdrawalsToday: "+15.7%",
      },
    });
  });

  it("renders the upgraded single-page admin dashboard header", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Admin Dashboard");
    expect(html).toContain("Monitor and manage Abay Chess operations.");
    expect(html).toContain("System Online");
  });

  it("renders all 8 KPI cards in the top row with Geist Mono and ETB formatting", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Total Players");
    expect(html).toContain("Online Now");
    expect(html).toContain("Active Games");
    expect(html).toContain("Recorded Platform Funds");
    expect(html).toContain("Locked Escrow");
    expect(html).toContain("Revenue Today");
    expect(html).toContain("Deposits Today");
    expect(html).toContain("Withdrawals Today");
    expect(html).toContain("ETB");
  });

  it("renders Overview, Pending Actions, and Quick Actions", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Pending Actions");
    expect(html).toContain("Quick Actions");
    expect(html).toContain("Inspect Player");
    expect(html).toContain("Process Deposit");
    expect(html).toContain("Process Withdrawal");
  });

  it("renders Financial Overview, Recent Activity, and System Health", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Financial Overview");
    expect(html).toContain("Recent Activity");
    expect(html).toContain("System Health");
    expect(html).toContain("User Liabilities");
  });

  it("renders Transaction History, User Feedback, and Wallet Security Controls", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain("Transaction History");
    expect(html).toContain("User Feedback");
    expect(html).toContain("Wallet Security &amp; Freeze Controls");
  });

  it("strictly omits any university or campus concepts", () => {
    const html = renderToStaticMarkup(<AdminView />);
    expect(html.toLowerCase()).not.toContain("university");
    expect(html.toLowerCase()).not.toContain("campus");
    expect(html.toLowerCase()).not.toContain("student id");
  });
});
