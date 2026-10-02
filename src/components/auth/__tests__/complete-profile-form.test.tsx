// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  me: {
    _id: "p1",
    username: "testuser",
    displayName: "Test User",
    profileCompleted: false,
  } as any,
  universities: [
    { _id: "uni1", name: "Addis Ababa University", shortName: "AAU", city: "Addis Ababa" },
    { _id: "uni2", name: "Adama Science and Technology University", shortName: "ASTU", city: "Adama" },
  ],
  checkAvailability: vi.fn().mockResolvedValue({ available: true }),
  completeProfile: vi.fn().mockResolvedValue({ success: true }),
}));

import { getFunctionName } from "convex/server";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useQuery: (queryKey: any, args: any) => {
    if (args === "skip" || queryKey === "skip") return undefined;
    try {
      const name = getFunctionName(queryKey);
      if (name === "universities:listUniversities") return state.universities;
      if (name === "players:checkUsernameAvailability") return { available: true };
      if (name === "players:me") return state.me;
    } catch {}
    return state.me;
  },
  useMutation: () => state.completeProfile,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/complete-profile",
}));

const { PhoneInput, validatePhoneNumber } = await import("../phone-input");
const { CompleteProfileForm } = await import("../complete-profile-form");

describe("PhoneInput & Phone Validation", () => {
  it("validates Ethiopian phone numbers (+251 9... or +251 7...)", () => {
    expect(validatePhoneNumber("+251912345678")).toBe(true);
    expect(validatePhoneNumber("+251712345678")).toBe(true);
    // 8 digits instead of 9
    expect(validatePhoneNumber("+25191234567")).toBe(false);
    // Starts with 8 instead of 9 or 7
    expect(validatePhoneNumber("+251812345678")).toBe(false);
  });

  it("validates general international E.164 phone numbers", () => {
    expect(validatePhoneNumber("+14155552671")).toBe(true);
    expect(validatePhoneNumber("+447911123456")).toBe(true);
    expect(validatePhoneNumber("0912345678")).toBe(false); // missing country code
    expect(validatePhoneNumber("")).toBe(false);
  });

  it("renders PhoneInput with default country selector", () => {
    const html = renderToStaticMarkup(
      <PhoneInput value="+251912345678" onChange={() => {}} />,
    );
    expect(html).toContain("+251");
    expect(html).toContain("Ethiopia");
  });
});

describe("CompleteProfileForm", () => {
  it("renders basic info fields and exactly two player types (no staff)", () => {
    const html = renderToStaticMarkup(<CompleteProfileForm initialPlayerType="public_player" />);
    // Basic info fields
    expect(html).toContain("Username");
    expect(html).toContain("Display Name");
    expect(html).toContain("Phone Number");

    // Player types
    expect(html).toContain("University Student");
    expect(html).toContain("Public Player");
    expect(html.toLowerCase()).not.toContain("university staff");
    expect(html.toLowerCase()).not.toContain("staff member");
  });

  it("renders university fields and immutability notice when player type is student", () => {
    const html = renderToStaticMarkup(<CompleteProfileForm initialPlayerType="university_student" />);
    expect(html).toContain("Select your university");
    expect(html).toContain("Student ID");
    expect(html).toContain("Verification Pending");
    expect(html).toContain("University cannot be changed after profile completion");
  });

  it("does not render university fields when player type is public_player", () => {
    const html = renderToStaticMarkup(<CompleteProfileForm initialPlayerType="public_player" />);
    expect(html).not.toContain("Select your university");
    expect(html).not.toContain("Student ID");
    expect(html).not.toContain("University cannot be changed after profile completion");
  });
});
