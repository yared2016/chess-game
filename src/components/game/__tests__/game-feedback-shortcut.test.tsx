// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GameView } from "@/lib/types";
import { GameResultDialog } from "../game-result-dialog";
import { GameActionBar } from "../game-action-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div data-slot="dialog">{children}</div>,
  DialogContent: ({ children }: any) => <div data-slot="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
  DialogClose: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/analysis/game-review-panel", () => ({
  GameReviewPanel: () => <div data-testid="game-review-panel" />,
}));

vi.mock("@/components/game/fair-play-report-modal", () => ({
  FairPlayReportModal: () => <div data-testid="fair-play-modal" />,
}));

describe("In-Game Feedback Shortcut", () => {
  const mockGame: any = {
    _id: "game_test_123",
    _creationTime: 123456789,
    status: "checkmate",
    winner: "w",
    turn: "w",
    mode: "online",
    undoCount: 0,
    rated: true,
    moves: [],
    pgn: "",
  };

  const mockView: any = {
    game: mockGame,
    white: { _id: "p1", username: "Magnus", rating: 2800 },
    black: { _id: "p2", username: "Hikaru", rating: 2790 },
    whiteName: "Magnus",
    blackName: "Hikaru",
    whitePlayer: null,
    blackPlayer: null,
  };

  it("renders a feedback shortcut link with gameId and opponent in GameResultDialog", () => {
    const markup = renderToStaticMarkup(
      <GameResultDialog
        view={mockView}
        seat="w"
        rating={{ delta: 12, after: 2812 }}
        playAgainPending={false}
        onPlayAgain={() => {}}
        isOpen={true}
      />,
    );

    expect(markup).toContain('href="/feedback?gameId=game_test_123&amp;opponent=Hikaru"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain("Feedback");
  });

  it("renders feedback shortcut in GameActionBar", () => {
    const mockActions: any = {
      undo: vi.fn(),
      offerDraw: vi.fn(),
      resign: vi.fn(),
      copyPgn: vi.fn(),
      downloadPgn: vi.fn(),
      setOrientation: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <GameActionBar
        mode="online"
        seat="w"
        boardView="3d"
        webglAvailable={true}
        orientation="w"
        focus={false}
        pending={false}
        canUndo={false}
        canResign={true}
        canOfferDraw={true}
        drawOffered={false}
        hint={{ available: false, remaining: 0, disabledReason: null, request: () => {} }}
        actions={mockActions}
        onToggleView={() => {}}
        onToggleFocus={() => {}}
        onOpenRoom={() => {}}
        onOpenShortcuts={() => {}}
        feedbackHref="/feedback?gameId=game_test_123&opponent=Hikaru"
      />,
    );

    expect(markup).toContain("Feedback");
    expect(markup).toContain("lucide-message-square-plus");
  });
});
