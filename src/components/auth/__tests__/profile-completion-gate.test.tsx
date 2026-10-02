// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  isLoading: false,
  me: null as any,
  pathname: "/play",
  replace: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: state.authenticated,
    isLoading: state.isLoading,
  }),
  useQuery: () => state.me,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({
    replace: state.replace,
  }),
}));

const { ProfileCompletionGate } = await import("../profile-completion-gate");

describe("ProfileCompletionGate", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.isLoading = false;
    state.me = null;
    state.pathname = "/play";
    state.replace.mockReset();
  });

  it("renders loading screen and suppresses protected children while auth/profile is pending", () => {
    state.me = undefined; // convex query loading
    const html = renderToStaticMarkup(
      <ProfileCompletionGate>
        <div id="protected-content">Dashboard</div>
      </ProfileCompletionGate>,
    );
    expect(html).toContain("Checking player credentials...");
    expect(html).not.toContain("protected-content");
  });

  it("renders redirecting message and suppresses protected children when profile is incomplete", () => {
    state.me = {
      _id: "p1",
      username: "alex",
      profileCompleted: false,
    };
    const html = renderToStaticMarkup(
      <ProfileCompletionGate>
        <div id="protected-content">Dashboard</div>
      </ProfileCompletionGate>,
    );
    expect(html).toContain("Redirecting to profile setup...");
    expect(html).not.toContain("protected-content");
  });

  it("renders protected children when profile is completed", () => {
    state.me = {
      _id: "p1",
      username: "alex",
      profileCompleted: true,
    };
    const html = renderToStaticMarkup(
      <ProfileCompletionGate>
        <div id="protected-content">Dashboard</div>
      </ProfileCompletionGate>,
    );
    expect(html).toContain("protected-content");
    expect(html).toContain("Dashboard");
  });
});
