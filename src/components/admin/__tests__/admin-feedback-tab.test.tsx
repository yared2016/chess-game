// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminFeedbackTab } from "../admin-feedback-tab";
import { FeedbackDetailModal, FeedbackItem } from "../feedback-detail-modal";
import type { Id } from "../../../../convex/_generated/dataModel";

const mockStatsQuery = vi.hoisted(() => vi.fn());
const mockListQuery = vi.hoisted(() => vi.fn());
const mockAttachmentQuery = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (_fn: unknown, args: Record<string, unknown> | undefined) => {
    if (args?.feedbackId && args?.storageId) {
      return mockAttachmentQuery(args);
    }
    if (args && ("status" in args || "category" in args || "limit" in args || "search" in args)) {
      return mockListQuery(args);
    }
    return mockStatsQuery(args);
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

beforeEach(() => {
  mockStatsQuery.mockReset().mockReturnValue({
    total: 42,
    newCount: 8,
    inReviewCount: 12,
    resolvedCount: 18,
    featureRequestsCount: 4,
  });

  mockListQuery.mockReset().mockReturnValue([
    {
      _id: "fb_admin_test_1" as unknown as Id<"feedback">,
      userId: "player_123" as unknown as Id<"players">,
      clerkId: "clerk_123",
      userName: "Grandmaster Kasparov",
      userEmail: "kasparov@chess.org",
      category: "chess_game",
      description: "Castling was permitted after rook move in turn 10.",
      gameId: "game_blitz_999",
      opponentUsername: "deep_blue",
      attachments: [
        {
          storageId: "storage_abc" as unknown as Id<"_storage">,
          fileName: "illegal_castle.png",
          fileType: "image/png",
          fileSize: 1048576,
          uploadedAt: 1700000000000,
        },
      ],
      status: "NEW",
      emailStatus: "SENT",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ]);

  mockAttachmentQuery.mockReset().mockReturnValue("https://convex.cloud/signed-storage-url");
});

describe("AdminFeedbackTab Component", () => {
  it("renders metric cards with correct counts", () => {
    const markup = renderToStaticMarkup(<AdminFeedbackTab />);
    expect(markup).toContain("Total Tickets");
    expect(markup).toContain("42");
    expect(markup).toContain("New Tickets");
    expect(markup).toContain("8");
    expect(markup).toContain("In Review");
    expect(markup).toContain("12");
    expect(markup).toContain("Resolved");
    expect(markup).toContain("18");
    expect(markup).toContain("Feature Ideas");
    expect(markup).toContain("4");
  });

  it("renders search input, filter selects, and feedback ticket rows", () => {
    const markup = renderToStaticMarkup(<AdminFeedbackTab />);
    expect(markup).toContain('placeholder="Search by player, email, text, game ID..."');
    expect(markup).toContain("All Statuses");
    expect(markup).toContain("All Categories");
    expect(markup).toContain("Grandmaster Kasparov");
    expect(markup).toContain("Chess Game");
    expect(markup).toContain("Castling was permitted after rook move in turn 10.");
    expect(markup).toContain("Game: #game_bli");
    expect(markup).toContain("Inspect");
  });
});

describe("FeedbackDetailModal Component", () => {
  const sampleTicket: FeedbackItem = {
    _id: "fb_admin_test_1" as unknown as Id<"feedback">,
    userId: "player_123" as unknown as Id<"players">,
    clerkId: "clerk_123",
    userName: "Grandmaster Kasparov",
    userEmail: "kasparov@chess.org",
    category: "chess_game",
    description: "Castling was permitted after rook move in turn 10.",
    gameId: "game_blitz_999",
    opponentUsername: "deep_blue",
    attachments: [
      {
        storageId: "storage_abc" as unknown as Id<"_storage">,
        fileName: "illegal_castle.png",
        fileType: "image/png",
        fileSize: 1048576,
        uploadedAt: 1700000000000,
      },
    ],
    status: "NEW",
    adminNotes: "Investigating moves list with engine validation.",
    emailStatus: "SENT",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  it("renders complete ticket inspection details and administrative controls", () => {
    const markup = renderToStaticMarkup(
      <FeedbackDetailModal feedback={sampleTicket} onClose={() => {}} />
    );
    expect(markup).toContain("Feedback Ticket");
    expect(markup).toContain("Grandmaster Kasparov");
    expect(markup).toContain("kasparov@chess.org");
    expect(markup).toContain("Chess Game");
    expect(markup).toContain("Game #game_blitz");
    expect(markup).toContain("Opponent: @deep_blue");
    expect(markup).toContain("Castling was permitted after rook move in turn 10.");
    expect(markup).toContain("illegal_castle.png");
    expect(markup).toContain("1.0 MB");
    expect(markup).toContain("Update Status");
    expect(markup).toContain("Mark New");
    expect(markup).toContain("In Review");
    expect(markup).toContain("Resolved");
    expect(markup).toContain("Close Ticket");
    expect(markup).toContain("Internal Staff Notes");
    expect(markup).toContain("Confidential · Never shown to players");
    expect(markup).toContain("Investigating moves list with engine validation.");
    expect(markup).toContain("Confirmation Email:");
    expect(markup).toContain("SENT");
  });
});
