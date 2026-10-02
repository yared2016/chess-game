// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  searchResults: [
    {
      _id: "p1",
      username: "kasparov_et",
      displayName: "Garry Kasparov",
      avatarUrl: "https://example.com/avatar1.png",
      rating: 1850,
      ratingHuman: 1850,
      playerType: "university_student",
      universityName: "Addis Ababa University",
      verificationStatus: "verified",
      isOnline: true,
      lastSeen: Date.now(),
    },
    {
      _id: "p2",
      username: "judit_p",
      displayName: "Judit Polgar",
      avatarUrl: "https://example.com/avatar2.png",
      rating: 1900,
      ratingHuman: 1900,
      playerType: "public_player",
      verificationStatus: "none",
      isOnline: false,
      lastSeen: Date.now() - 1000 * 60 * 30,
    },
  ],
  universities: [
    { _id: "uni1", name: "Addis Ababa University", shortName: "AAU", city: "Addis Ababa" },
  ],
}));

import { getFunctionName } from "convex/server";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useQuery: (queryKey: any, args: any) => {
    if (args === "skip" || queryKey === "skip") return undefined;
    try {
      const name = getFunctionName(queryKey);
      if (name === "discovery:searchPlayers") return state.searchResults;
      if (name === "universities:listUniversities") return state.universities;
    } catch {}
    return null;
  },
  useMutation: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/players",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

const { PlayerSearchHub } = await import("../player-search-hub");

describe("PlayerSearchHub", () => {
  beforeEach(() => {
    state.searchResults = [
      {
        _id: "p1",
        username: "kasparov_et",
        displayName: "Garry Kasparov",
        avatarUrl: "https://example.com/avatar1.png",
        rating: 1850,
        ratingHuman: 1850,
        playerType: "university_student",
        universityName: "Addis Ababa University",
        verificationStatus: "verified",
        isOnline: true,
        lastSeen: Date.now(),
      },
      {
        _id: "p2",
        username: "judit_p",
        displayName: "Judit Polgar",
        avatarUrl: "https://example.com/avatar2.png",
        rating: 1900,
        ratingHuman: 1900,
        playerType: "public_player",
        verificationStatus: "none",
        isOnline: false,
        lastSeen: Date.now() - 1000 * 60 * 30,
      },
    ];
  });

  it("renders search input, filter controls, and player directory cards", () => {
    const html = renderToStaticMarkup(<PlayerSearchHub />);
    expect(html).toContain("Player Directory");
    expect(html).toContain("Search players by username or display name...");
    expect(html).toContain("Online Now");
    expect(html).toContain("All Player Types");

    // Match player cards
    expect(html).toContain("Garry Kasparov");
    expect(html).toContain("@kasparov_et");
    expect(html).toContain("1850");
    expect(html).toContain("Addis Ababa University");

    expect(html).toContain("Judit Polgar");
    expect(html).toContain("@judit_p");
    expect(html).toContain("1900");
    expect(html).toContain("Public Player");
  });

  it("renders empty state when no matching players are found", () => {
    state.searchResults = [];
    const html = renderToStaticMarkup(<PlayerSearchHub />);
    expect(html).toContain("No players found matching your criteria");
  });
});
