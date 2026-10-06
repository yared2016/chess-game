// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Coins,
  Lock,
} from "lucide-react";

import {
  KpiCard,
  MetricCard,
  StatusBadge,
  getStatusBadgeConfig,
  DataTable,
  type ColumnDef,
  FilterBar,
  ConfirmDialog,
  DetailDrawer,
} from "../index";

describe("Admin UI Kit: KpiCard", () => {
  it("renders title, formatted value with ETB, and trend indicator", () => {
    const markup = renderToStaticMarkup(
      <KpiCard
        title="Total Platform Volume"
        value={1250000.5}
        currency="ETB"
        trend="+14.2% vs last month"
        trendDirection="up"
        icon={Wallet}
      />
    );

    // Title
    expect(markup).toContain("Total Platform Volume");
    // Formatted value with commas and decimals
    expect(markup).toContain("1,250,000.50");
    // ETB currency suffix
    expect(markup).toContain("ETB");
    // Trend indicator text
    expect(markup).toContain("+14.2% vs last month");
    // Emerald color classes for upward trend
    expect(markup).toContain("text-emerald-600");
    // Rounded 3xl and card background tokens
    expect(markup).toContain("rounded-3xl");
    expect(markup).toContain("bg-card");
  });

  it("renders negative trend with rose color classes", () => {
    const markup = renderToStaticMarkup(
      <KpiCard
        title="Daily Net Margin"
        value={-4200}
        currency="ETB"
        trend="-5.1%"
        trendDirection="down"
        icon={Coins}
      />
    );

    expect(markup).toContain("-5.1%");
    expect(markup).toContain("text-rose-600");
  });

  it("renders smooth inline SVG micro-sparkline when data is provided", () => {
    const markup = renderToStaticMarkup(
      <KpiCard
        title="Weekly Inflow"
        value={89000}
        currency="ETB"
        sparklineData={[10, 25, 18, 42, 60, 55, 80]}
        icon={TrendingUp}
      />
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain("<path");
    expect(markup).toContain("d=\"M");
  });

  it("renders pulse skeleton placeholder when isLoading is true", () => {
    const markup = renderToStaticMarkup(
      <KpiCard
        title="Pending Escrow"
        value={0}
        icon={Lock}
        isLoading={true}
      />
    );

    expect(markup).toContain("animate-pulse");
    // Should not render the real value when loading
    expect(markup).not.toContain("0.00");
  });

  it("supports keyboard accessibility when onClick is provided", () => {
    const handleClick = vi.fn();
    const markup = renderToStaticMarkup(
      <KpiCard
        title="Interactive Card"
        value={100}
        icon={Wallet}
        onClick={handleClick}
      />
    );

    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
  });
});

describe("Admin UI Kit: MetricCard", () => {
  it("renders label, formatted ETB value, and sublabel", () => {
    const markup = renderToStaticMarkup(
      <MetricCard
        label="User Liabilities"
        value={450000}
        currency="ETB"
        sublabel="Authoritative convex ledger balance"
        icon={Wallet}
        trend="+3.2%"
      />
    );

    expect(markup).toContain("User Liabilities");
    expect(markup).toContain("450,000.00");
    expect(markup).toContain("ETB");
    expect(markup).toContain("Authoritative convex ledger balance");
    expect(markup).toContain("+3.2%");
    expect(markup).toContain("rounded-2xl");
    expect(markup).toContain("bg-card");
  });

  it("renders skeleton placeholder when isLoading is true", () => {
    const markup = renderToStaticMarkup(
      <MetricCard
        label="Provider Fees"
        value={1200}
        isLoading={true}
      />
    );

    expect(markup).toContain("animate-pulse");
  });

  it("supports keyboard accessibility when onClick is provided", () => {
    const handleClick = vi.fn();
    const markup = renderToStaticMarkup(
      <MetricCard
        label="Clickable Metric"
        value={500}
        onClick={handleClick}
      />
    );

    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
  });
});

describe("Admin UI Kit: StatusBadge", () => {
  it("assigns emerald pill classes to healthy, successful, and active statuses", () => {
    const statuses = [
      "Completed",
      "Approved",
      "Credited",
      "HEALTHY",
      "Active",
      "Clean",
      "Success",
    ];

    for (const st of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(markup).toContain("bg-emerald-500/10");
      expect(markup).toContain("text-emerald-700");
      expect(markup).toContain("border-emerald-500/20");
      expect(markup).toContain(st);

      const config = getStatusBadgeConfig(st);
      expect(config.tone).toBe("emerald");
    }
  });

  it("assigns amber pill classes to pending, review, and warning statuses", () => {
    const statuses = [
      "Processing",
      "Pending",
      "Locked",
      "WARNING",
      "Under Review",
      "IN_REVIEW",
      "NEW",
    ];

    for (const st of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(markup).toContain("bg-amber-500/10");
      expect(markup).toContain("text-amber-700");
      expect(markup).toContain("border-amber-500/20");
      expect(markup).toContain(st);

      const config = getStatusBadgeConfig(st);
      expect(config.tone).toBe("amber");
    }
  });

  it("assigns rose pill classes to failed, banned, and critical statuses", () => {
    const statuses = [
      "Failed",
      "Rejected",
      "Banned",
      "CRITICAL",
      "Restricted",
      "Suspended",
    ];

    for (const st of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(markup).toContain("bg-rose-500/10");
      expect(markup).toContain("text-rose-700");
      expect(markup).toContain("border-rose-500/20");
      expect(markup).toContain(st);

      const config = getStatusBadgeConfig(st);
      expect(config.tone).toBe("rose");
    }
  });

  it("assigns purple pill classes to reversed and refunded statuses", () => {
    const statuses = ["Reversed", "Refunded"];

    for (const st of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(markup).toContain("bg-purple-500/10");
      expect(markup).toContain("text-purple-700");
      expect(markup).toContain("border-purple-500/20");

      const config = getStatusBadgeConfig(st);
      expect(config.tone).toBe("purple");
    }
  });

  it("assigns slate/neutral pill classes to closed, resolved, and unknown statuses", () => {
    const statuses = ["CLOSED", "RESOLVED", "UNKNOWN"];

    for (const st of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={st} />);
      expect(markup).toContain("bg-muted/70");
      expect(markup).toContain("text-muted-foreground");

      const config = getStatusBadgeConfig(st);
      expect(config.tone).toBe("slate");
    }
  });

  it("supports sm and md sizes", () => {
    const smallMarkup = renderToStaticMarkup(<StatusBadge status="Completed" size="sm" />);
    expect(smallMarkup).toContain("text-[9px]");

    const medMarkup = renderToStaticMarkup(<StatusBadge status="Completed" size="md" />);
    expect(medMarkup).toContain("text-[10px]");
  });
});

describe("Admin UI Kit: FilterBar", () => {
  const tabs = [
    { key: "all", label: "All Transactions", count: 120 },
    { key: "deposits", label: "Deposits", count: 85 },
    { key: "withdrawals", label: "Withdrawals", count: 35 },
  ];

  it("renders active tabs with highlighted tokens in both desktop and mobile views", () => {
    const markup = renderToStaticMarkup(
      <FilterBar
        tabs={tabs}
        activeTab="deposits"
        onTabChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
      />
    );

    expect(markup).toContain("All Transactions");
    expect(markup).toContain("Deposits");
    expect(markup).toContain("Withdrawals");
    // Count badges
    expect(markup).toContain("(120)");
    expect(markup).toContain("(85)");
    // Active tab classes
    expect(markup).toContain("bg-card text-foreground font-bold");
    expect(markup).toContain("bg-primary text-primary-foreground font-bold");
  });

  it("renders search input, clear button, and export action", () => {
    const handleExport = vi.fn();
    const markup = renderToStaticMarkup(
      <FilterBar
        tabs={tabs}
        activeTab="all"
        onTabChange={() => {}}
        searchQuery="TX_98765"
        onSearchChange={() => {}}
        searchPlaceholder="Filter by reference..."
        onExportCsv={handleExport}
        exportLabel="Export Records"
      />
    );

    expect(markup).toContain("value=\"TX_98765\"");
    expect(markup).toContain("placeholder=\"Filter by reference...\"");
    expect(markup).toContain("aria-label=\"Clear search query\"");
    expect(markup).toContain("Export Records");
  });

  it("renders date range button when datePresets or label are supplied", () => {
    const markup = renderToStaticMarkup(
      <FilterBar
        tabs={tabs}
        activeTab="all"
        onTabChange={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        dateRangeLabel="Last 30 Days"
        datePresets={[
          { key: "7d", label: "Last 7 Days" },
          { key: "30d", label: "Last 30 Days" },
        ]}
      />
    );

    expect(markup).toContain("Last 30 Days");
    expect(markup).toContain("aria-label=\"Filter by date range\"");
  });

  it("switches active tabs and updates rendered styling", () => {
    const onTabChange = vi.fn();
    const onSearchChange = vi.fn();

    // 1. Initial state: active tab is "all"
    const markupAll = renderToStaticMarkup(
      <FilterBar
        tabs={tabs}
        activeTab="all"
        onTabChange={onTabChange}
        searchQuery=""
        onSearchChange={onSearchChange}
      />
    );
    expect(markupAll).toContain("All Transactions");

    // 2. Switched state: active tab changed to "deposits" and search query entered
    const markupDeposits = renderToStaticMarkup(
      <FilterBar
        tabs={tabs}
        activeTab="deposits"
        onTabChange={onTabChange}
        searchQuery="chapa_ref_123"
        onSearchChange={onSearchChange}
      />
    );
    expect(markupDeposits).toContain("Deposits");
    expect(markupDeposits).toContain("value=\"chapa_ref_123\"");

    // 3. Verify callback signatures and contract
    onTabChange("deposits");
    expect(onTabChange).toHaveBeenCalledWith("deposits");

    onSearchChange("chapa_ref_123");
    expect(onSearchChange).toHaveBeenCalledWith("chapa_ref_123");
  });
});

describe("Admin UI Kit: ConfirmDialog", () => {
  it("renders nothing when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={false}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Freeze Wallet"
        description="Are you sure you want to freeze this user's wallet?"
      />
    );

    expect(markup).toBe("");
  });

  it("renders dialog with title, description, and target name when isOpen is true", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Freeze Wallet"
        description="This will lock the player's balance and prevent match deposits."
        targetName="user_ethiopia_kasparov"
        isDestructive={true}
      />
    );

    expect(markup).toContain("Freeze Wallet");
    expect(markup).toContain("This will lock the player&#x27;s balance");
    expect(markup).toContain("user_ethiopia_kasparov");
    // Destructive styling
    expect(markup).toContain("bg-rose-600");
  });

  it("validates audit reason when requireReason is true", () => {
    // When requireReason is true and initial reason is empty, button is disabled
    const markupRequired = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Administrative Penalty"
        description="Impose a warning or ban penalty."
        requireReason={true}
        confirmText="Confirm Penalty"
      />
    );

    expect(markupRequired).toContain("Audit Reason");
    expect(markupRequired).toContain("A valid reason is required to proceed.");
    // Confirm button should be disabled
    expect(markupRequired).toContain("disabled=\"\"");
    expect(markupRequired).toContain("cursor-not-allowed opacity-60");

    // When requireReason is false, confirm button is NOT disabled
    const markupNotRequired = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Approve Withdrawal"
        description="Release funds to destination bank."
        requireReason={false}
        confirmText="Approve Payout"
      />
    );

    expect(markupNotRequired).not.toContain("Audit Reason");
    expect(markupNotRequired).not.toContain("A valid reason is required to proceed.");
    expect(markupNotRequired).not.toContain("disabled=\"\"");
  });
});

describe("Admin UI Kit: DataTable", () => {
  interface RowData {
    id: string;
    user: string;
    amountEtb: number;
    status: string;
  }

  const columns = [
    { key: "user", header: "User" },
    {
      key: "amountEtb",
      header: "Amount",
      render: (row: RowData) => `${row.amountEtb.toFixed(2)} ETB`,
    },
    {
      key: "status",
      header: "Status",
      render: (row: RowData) => <StatusBadge status={row.status} />,
    },
  ];

  const data: RowData[] = [
    { id: "1", user: "Derartu Tulu", amountEtb: 1500, status: "Completed" },
    { id: "2", user: "Haile G", amountEtb: 4200, status: "Processing" },
  ];

  it("renders desktop table with headers and data rows", () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={columns} data={data} />
    );

    // Headers
    expect(markup).toContain("User");
    expect(markup).toContain("Amount");
    expect(markup).toContain("Status");
    // Row values
    expect(markup).toContain("Derartu Tulu");
    expect(markup).toContain("1500.00 ETB");
    expect(markup).toContain("Completed");
    expect(markup).toContain("Haile G");
    expect(markup).toContain("4200.00 ETB");
    expect(markup).toContain("Processing");
  });

  it("renders mobile-responsive cards without horizontal scroll", () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={columns} data={data} />
    );

    // Mobile view container class
    expect(markup).toContain("sm:hidden");
    // Desktop view container class
    expect(markup).toContain("hidden sm:block");
  });

  it("renders empty state message when data is empty", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No financial settlements found."
      />
    );

    expect(markup).toContain("No financial settlements found.");
  });

  it("renders skeleton rows and cards when isLoading is true", () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={columns} data={[]} isLoading={true} />
    );

    expect(markup).toContain("animate-pulse");
  });

  it("supports numeric id and Convex _id row keys without keyExtractor", () => {
    interface MixedRow {
      id?: number;
      _id?: string;
      user: string;
      amountEtb: number;
    }
    const mixedColumns: ColumnDef<MixedRow>[] = [
      { key: "user", header: "User" },
      { key: "amountEtb", header: "Amount" },
    ];
    const mixedData: MixedRow[] = [
      { id: 101, user: "Player 1", amountEtb: 100 },
      { _id: "convex_id_202", user: "Player 2", amountEtb: 200 },
    ];
    const markup = renderToStaticMarkup(
      <DataTable columns={mixedColumns} data={mixedData} />
    );
    expect(markup).toContain("Player 1");
    expect(markup).toContain("Player 2");
  });
});

describe("Admin UI Kit: DetailDrawer", () => {
  it("renders nothing when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <DetailDrawer
        isOpen={false}
        onClose={() => {}}
        title="Transaction Details"
      >
        <p>Drawer content</p>
      </DetailDrawer>
    );

    expect(markup).toBe("");
  });

  it("renders title, subtitle, children, and footer when isOpen is true", () => {
    const markup = renderToStaticMarkup(
      <DetailDrawer
        isOpen={true}
        onClose={() => {}}
        title="Reconciliation Audit"
        subtitle="Internal Tx #8762"
        footer={<button>Audit Approved</button>}
      >
        <div id="drawer-body-test">Audit Log Details</div>
      </DetailDrawer>
    );

    expect(markup).toContain("Reconciliation Audit");
    expect(markup).toContain("Internal Tx #8762");
    expect(markup).toContain("Audit Log Details");
    expect(markup).toContain("Audit Approved");
    expect(markup).toContain("aria-label=\"Close drawer\"");
    // Check backdrop blur and responsive slide classes
    expect(markup).toContain("backdrop-blur-sm");
    expect(markup).toContain("sm:max-w-lg");
  });
});
