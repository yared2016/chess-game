// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  recommended: [
    {
      _id: "p1",
      username: "abebe_b",
      displayName: "Abebe Bikila",
      avatarUrl: "https://example.com/avatar1.png",
      rating: 1550,
      ratingHuman: 1550,
      isOnline: true,
      lastSeen: Date.now(),
      recommendationScore: 0.88,
    },
    {
      _id: "p2",
      username: "almaz_a",
      displayName: "Almaz Ayana",
      avatarUrl: "https://example.com/avatar2.png",
      rating: 1520,
      ratingHuman: 1520,
      isOnline: false,
      lastSeen: Date.now() - 1000 * 60 * 15, // 15m ago
      recommendationScore: 0.75,
    },
  ],
  online: [
    {
      _id: "p1",
      username: "abebe_b",
      displayName: "Abebe Bikila",
      avatarUrl: "https://example.com/avatar1.png",
      rating: 1550,
      ratingHuman: 1550,
      isOnline: true,
      lastSeen: Date.now(),
    },
  ],
  createChallenge: vi.fn().mockResolvedValue({ challengeId: "c1" }),
}));

import { getFunctionName } from "convex/server";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useQuery: (queryKey: any, args: any) => {
    if (args === "skip" || queryKey === "skip") return undefined;
    try {
      const name = getFunctionName(queryKey);
      if (name === "discovery:getRecommendedPlayers") return state.recommended;
      if (name === "discovery:getOnlinePlayers") return state.online;
    } catch {}
    return null;
  },
  useMutation: () => state.createChallenge,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/play",
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div data-slot="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: any) => <h2 className={className}>{children}</h2>,
  DialogDescription: ({ children, className }: any) => <p className={className}>{children}</p>,
}));

const { PlayersYouMayLike } = await import("../players-you-may-like");
const { OnlineNowRail } = await import("../online-now-rail");
const { FindOpponentModal } = await import("../find-opponent-modal");

describe("PlayersYouMayLike", () => {
  it("renders recommended player cards with ratings and names", () => {
    const html = renderToStaticMarkup(<PlayersYouMayLike />);
    expect(html).toContain("Players You May Want to Play");
    expect(html).toContain("Abebe Bikila");
    expect(html).toContain("@abebe_b");
    expect(html).toContain("1550");
    expect(html).toContain("Online");

    // Public player card
    expect(html).toContain("Almaz Ayana");
    expect(html).toContain("@almaz_a");
    expect(html).toContain("1520");

    // No campus/university text
    expect(html.toLowerCase()).not.toContain("university");
    expect(html.toLowerCase()).not.toContain("campus");
  });

  it("renders empty state when no recommendations are returned", () => {
    state.recommended = [];
    const html = renderToStaticMarkup(<PlayersYouMayLike />);
    expect(html).toContain("No recommendations available right now");
  });
});

describe("OnlineNowRail", () => {
  it("renders online player rail with active status dot and count", () => {
    state.online = [
      {
        _id: "p1",
        username: "abebe_b",
        displayName: "Abebe Bikila",
        avatarUrl: "https://example.com/avatar1.png",
        rating: 1550,
        ratingHuman: 1550,
        isOnline: true,
        lastSeen: Date.now(),
      },
    ];
    const html = renderToStaticMarkup(<OnlineNowRail />);
    expect(html).toContain("Online Now");
    expect(html).toContain("Abebe Bikila");
    expect(html).toContain("1550");
  });
});

describe("FindOpponentModal", () => {
  it("renders challenge dialog with opponent details and time controls", () => {
    const opponent = {
      _id: "p1" as any,
      username: "abebe_b",
      displayName: "Abebe Bikila",
      ratingHuman: 1550,
      avatarUrl: "https://example.com/avatar1.png",
    };
    const html = renderToStaticMarkup(
      <FindOpponentModal
        isOpen={true}
        onClose={() => {}}
        opponent={opponent}
      />,
    );
    expect(html).toContain("Challenge Abebe Bikila");
    expect(html).toContain("@abebe_b");
    expect(html).toContain("Time Control");
    expect(html).toContain("Play As");
    expect(html).toContain("White");
    expect(html).toContain("Random");
    expect(html).toContain("Black");
    expect(html).toContain("Match Stake (ETB)");
    expect(html).toContain("Casual");
    expect(html).toContain("Custom");
    expect(html).toContain("Send Challenge");
  });
});
