// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  loaded: true,
  signedIn: true,
}));
let currentPath = "/play";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: session.loaded, isSignedIn: session.signedIn }),
}));

const { MobileHeaderNav } = await import("../mobile-header-nav");

beforeEach(() => {
  session.loaded = true;
  session.signedIn = true;
  currentPath = "/play";
});

describe("MobileHeaderNav", () => {
  it("renders primary links for signed in users including wallet and history", () => {
    const markup = renderToStaticMarkup(<MobileHeaderNav />);
    expect(markup).toContain('href="/play"');
    expect(markup).toContain('href="/puzzles"');
    expect(markup).toContain('href="/tournaments"');
    expect(markup).toContain('href="/leaderboard"');
    expect(markup).toContain('href="/university"');
    expect(markup).toContain('href="/wallet"');
    expect(markup).toContain('href="/history"');
  });

  it("renders public links for guests without wallet and history", () => {
    session.signedIn = false;
    const markup = renderToStaticMarkup(<MobileHeaderNav />);
    expect(markup).toContain('href="/play"');
    expect(markup).toContain('href="/puzzles"');
    expect(markup).toContain('href="/tournaments"');
    expect(markup).toContain('href="/leaderboard"');
    expect(markup).toContain('href="/university"');
    expect(markup).not.toContain('href="/wallet"');
    expect(markup).not.toContain('href="/history"');
  });

  it("hides navigation during live gameplay so board interaction is not obstructed", () => {
    currentPath = "/game/test-game-123";
    const markup = renderToStaticMarkup(<MobileHeaderNav />);
    expect(markup).toBe("");
  });
});
