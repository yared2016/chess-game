// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  me: { _id: "p_me", username: "viewer_player" },
  presence: { isOnline: true, lastSeen: Date.now() },
  isFriend: { status: "none" },
}));

import { getFunctionName } from "convex/server";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useQuery: (queryKey: any, args: any) => {
    if (args === "skip" || queryKey === "skip") return undefined;
    try {
      const name = getFunctionName(queryKey);
      if (name === "players:me") return state.me;
      if (name === "presence:getPresence") return state.presence;
      if (name === "friends:isFriend") return state.isFriend;
    } catch {}
    return null;
  },
  useMutation: () => vi.fn(),
  usePreloadedQuery: (preloaded: any) => preloaded,
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ openUserProfile: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/profile/abebe_b",
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

const { ProfileHeaderView } = await import("../profile-header");

describe("ProfileHeaderView & Privacy Enforcement", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.presence = { isOnline: true, lastSeen: Date.now() };
  });

  it("renders display name, username, verified university badge, and online presence", () => {
    const studentProfile = {
      _id: "p1",
      username: "abebe_b",
      displayName: "Abebe Bikila",
      avatarUrl: "https://example.com/avatar.png",
      rating: 1750,
      ratingHuman: 1750,
      ratingAi: 1500,
      wins: 40,
      losses: 10,
      draws: 5,
      createdAt: 1700000000000,
      playerType: "university_student" as const,
      universityName: "Addis Ababa University",
      universityId: "uni1",
      verificationStatus: "verified" as const,
    };

    const html = renderToStaticMarkup(<ProfileHeaderView profile={studentProfile} />);

    // Display Name and @username
    expect(html).toContain("Abebe Bikila");
    expect(html).toContain("@abebe_b");

    // Rating and Stats
    expect(html).toContain("1750");

    // University and Verified Badge
    expect(html).toContain("Addis Ababa University");
    expect(html).toContain("Verified Student");

    // Presence
    expect(html).toContain("Online");

    // PRIVACY ENFORCEMENT: Never render phone or student ID
    expect(html).not.toContain("+251");
    expect(html).not.toContain("studentId");
    expect(html).not.toContain("UGR/");
  });

  it("renders public player badge and offline last-seen time", () => {
    state.presence = {
      isOnline: false,
      lastSeen: Date.now() - 1000 * 60 * 25, // 25 min ago
    };

    const publicProfile = {
      _id: "p2",
      username: "almaz_a",
      displayName: "Almaz Ayana",
      avatarUrl: "https://example.com/avatar2.png",
      rating: 1600,
      ratingHuman: 1600,
      ratingAi: 1400,
      wins: 20,
      losses: 5,
      draws: 2,
      createdAt: 1700000000000,
      playerType: "public_player" as const,
      verificationStatus: "none" as const,
    };

    const html = renderToStaticMarkup(<ProfileHeaderView profile={publicProfile} />);

    expect(html).toContain("Almaz Ayana");
    expect(html).toContain("@almaz_a");
    expect(html).toContain("Public Player");
    expect(html).toContain("Last seen 25 min ago");
    expect(html).not.toContain("Verified Student");
  });
});
