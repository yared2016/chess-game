// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FriendActionSheet } from "../friend-action-sheet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("FriendActionSheet", () => {
  const dummyFriend = {
    _id: "p1" as any,
    friendshipId: "f1" as any,
    username: "fikadu",
    rating: 1200,
    ratingHuman: 1200,
  };

  it("renders friend identity, online indicator, and primary actions in static markup", () => {
    const markup = renderToStaticMarkup(
      <FriendActionSheet
        friend={dummyFriend}
        open={true}
        onOpenChange={vi.fn()}
        onChallenge={vi.fn()}
        onRemoveFriend={vi.fn()}
        onBlockPlayer={vi.fn()}
        forceRenderInServer={true}
      />
    );

    // Friend name and rating
    expect(markup).toContain("fikadu");
    expect(markup).toContain("1200");
    expect(markup).toContain("ELO");

    // Primary and secondary actions
    expect(markup).toContain("Play Match");
    expect(markup).toContain("View Profile");

    // Danger zone actions
    expect(markup).toContain("Remove Friend");
    expect(markup).toContain("Block Player");

    // Accessible modal attributes
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
  });

  it("does not render when open is false", () => {
    const markup = renderToStaticMarkup(
      <FriendActionSheet
        friend={dummyFriend}
        open={false}
        onOpenChange={vi.fn()}
        onChallenge={vi.fn()}
        onRemoveFriend={vi.fn()}
        onBlockPlayer={vi.fn()}
        forceRenderInServer={true}
      />
    );
    expect(markup).toBe("");
  });
});
