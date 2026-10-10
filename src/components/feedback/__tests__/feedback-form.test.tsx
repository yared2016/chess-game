// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CATEGORIES, FeedbackForm } from "../feedback-form";
import {
  FileUploader,
  formatFileSize,
  ALLOWED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_COUNT,
} from "../file-uploader";
import { MyFeedbackList } from "../my-feedback-list";
import { FeedbackView } from "../feedback-view";
import type { Id } from "../../../../convex/_generated/dataModel";

const mockFeedbackQuery = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: mockFeedbackQuery,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("gameId=chess_test_123&opponent=magnus"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  mockFeedbackQuery.mockReset().mockReturnValue([]);
});

describe("Feedback Categories Configuration", () => {
  it("contains all 9 expected categories", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      "chess_game",
      "matchmaking",
      "tournaments",
      "wallet_payments",
      "account_profile",
      "website_app",
      "feature_request",
      "report_problem",
      "general_feedback",
    ]);
  });

  it("every category has non-empty label, helper text, and placeholder", () => {
    for (const cat of CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.helper.length).toBeGreaterThan(0);
      expect(cat.placeholder.length).toBeGreaterThan(0);
    }
  });
});

describe("File Uploader Constants and Utilities", () => {
  it("formats file sizes correctly across units", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("permits standard image and PDF MIME types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
  });

  it("blocks dangerous script and binary extensions", () => {
    expect(BLOCKED_EXTENSIONS).toContain(".exe");
    expect(BLOCKED_EXTENSIONS).toContain(".bat");
    expect(BLOCKED_EXTENSIONS).toContain(".cmd");
    expect(BLOCKED_EXTENSIONS).toContain(".sh");
    expect(BLOCKED_EXTENSIONS).toContain(".js");
  });

  it("enforces max 5 files and 10MB limits", () => {
    expect(MAX_FILES_COUNT).toBe(5);
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("renders drop zone markup", () => {
    const markup = renderToStaticMarkup(
      <FileUploader files={[]} onFilesChange={() => {}} />
    );
    expect(markup).toContain("Drop files here");
    expect(markup).toContain("PNG, JPG, WEBP, or PDF");
  });
});

describe("FeedbackForm Component", () => {
  it("renders all categories and form inputs", () => {
    const markup = renderToStaticMarkup(<FeedbackForm />);
    expect(markup).toContain("What kind of feedback are you sharing?");
    expect(markup).toContain("Chess Game &amp; Board");
    expect(markup).toContain("Matchmaking &amp; Queue");
    expect(markup).toContain("Report a Bug");
    expect(markup).toContain("Your Message");
    expect(markup).toContain("Submit Feedback");
  });

  it("pre-fills chess match context when initialContext is provided", () => {
    const markup = renderToStaticMarkup(
      <FeedbackForm
        initialContext={{
          gameId: "game_auto_123",
          opponentUsername: "hikaru",
        }}
      />
    );
    expect(markup).toContain("Attached #game_aut");
    expect(markup).toContain('value="game_auto_123"');
    expect(markup).toContain('value="hikaru"');
  });

  it("renders validation warning when optional match context entity is not found", () => {
    mockFeedbackQuery.mockReturnValue({
      game: { provided: true, valid: false, error: "Game ID not found in system" },
      opponent: { provided: true, valid: false, error: 'Player "@ghost_player" does not exist' },
      match: { provided: false, valid: true },
      tournament: { provided: false, valid: true },
      allValid: false,
    });

    const markup = renderToStaticMarkup(
      <FeedbackForm
        initialContext={{
          gameId: "fake_game_999",
          opponentUsername: "ghost_player",
        }}
      />
    );

    expect(markup).toContain("Invalid match details");
    expect(markup).toContain("Game ID not found in system");
    expect(markup).toContain('Player &quot;@ghost_player&quot; does not exist');
  });

  it("renders verified indicators when match details exist", () => {
    mockFeedbackQuery.mockReturnValue({
      game: { provided: true, valid: true, label: "Game #game_aut (online)" },
      opponent: { provided: true, valid: true, label: "@hikaru (2800 Elo)" },
      match: { provided: false, valid: true },
      tournament: { provided: false, valid: true },
      allValid: true,
    });

    const markup = renderToStaticMarkup(
      <FeedbackForm
        initialContext={{
          gameId: "game_auto_123",
          opponentUsername: "hikaru",
        }}
      />
    );

    expect(markup).toContain("✓ Game #game_aut (online)");
    expect(markup).toContain("✓ @hikaru (2800 Elo)");
  });
});

describe("MyFeedbackList Component", () => {
  it("renders empty state when player has no submissions", () => {
    mockFeedbackQuery.mockReturnValue([]);
    const markup = renderToStaticMarkup(<MyFeedbackList />);
    expect(markup).toContain("No Feedback Yet");
    expect(markup).toContain("You have not submitted any feedback tickets yet");
  });

  it("renders submissions list with category, status, and context", () => {
    mockFeedbackQuery.mockReturnValue([
      {
        _id: "fb_123" as unknown as Id<"feedback">,
        category: "chess_game",
        description: "En passant did not allow capture on e6.",
        gameId: "game_blitz_77",
        opponentUsername: "gm_bot",
        status: "IN_REVIEW",
        createdAt: 1700000000000,
        attachments: [
          {
            storageId: "storage_1" as unknown as Id<"_storage">,
            fileName: "screenshot.png",
            fileType: "image/png",
            fileSize: 2048,
            uploadedAt: 1700000000000,
          },
        ],
      },
    ]);

    const markup = renderToStaticMarkup(<MyFeedbackList />);
    expect(markup).toContain("Chess Game");
    expect(markup).toContain("Under Review");
    expect(markup).toContain("En passant did not allow capture on e6.");
    expect(markup).toContain("Game #game_bli");
    expect(markup).toContain("vs @gm_bot");
    expect(markup).toContain("screenshot.png");
    // Ensure adminNotes is never rendered
    expect(markup).not.toContain("adminNotes");
  });
});

describe("FeedbackView Component", () => {
  it("renders header, tab triggers, and initial context from search params", () => {
    const markup = renderToStaticMarkup(<FeedbackView />);
    expect(markup).toContain("Abay Chess Feedback");
    expect(markup).toContain("Share Feedback");
    expect(markup).toContain("My Submissions");
    expect(markup).toContain("Attached #chess_te");
  });
});
