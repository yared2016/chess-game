// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  me: {
    _id: "p1",
    username: "yaredusk",
    displayName: "Yaya",
    profileCompleted: true,
    playerType: "university_student",
    universityId: "u_astu",
  },
  universities: [
    {
      _id: "u_aau",
      name: "Addis Ababa University",
      shortName: "AAU",
      city: "Addis Ababa",
      totalPlayers: 19,
      averageRating: 1451,
      totalWins: 142,
    },
    {
      _id: "u_aastu",
      name: "Addis Ababa Science and Technology University",
      shortName: "AASTU",
      city: "Addis Ababa",
      totalPlayers: 12,
      averageRating: 1440,
      totalWins: 98,
    },
    {
      _id: "u_bdu",
      name: "Bahir Dar University",
      shortName: "BDU",
      city: "Bahir Dar",
      totalPlayers: 13,
      averageRating: 1425,
      totalWins: 105,
    },
    {
      _id: "u_astu",
      name: "Adama Science and Technology University",
      shortName: "ASTU",
      city: "Adama",
      totalPlayers: 18,
      averageRating: 1404,
      totalWins: 188,
    },
  ],
  myUniversity: {
    _id: "u_astu",
    name: "Adama Science and Technology University",
    shortName: "ASTU",
    city: "Adama",
  },
}));

import { getFunctionName } from "convex/server";

vi.mock("convex/react", () => ({
  useQuery: (queryKey: any, args: any) => {
    if (args === "skip" || queryKey === "skip") return undefined;
    try {
      const name = getFunctionName(queryKey);
      if (name === "players:me") return state.me;
      if (name === "universities:listUniversities") return state.universities;
      if (name === "universities:getMyUniversity") return state.myUniversity;
      if (name === "universities:getUniversity") return null;
    } catch {}
    return null;
  },
  useMutation: () => vi.fn(),
}));

const { UniversityLeaderboard } = await import("../university-leaderboard");

describe("UniversityLeaderboard immutability UI", () => {
  it("locks campus affiliation and shows View Roster when profile is completed", () => {
    state.me.profileCompleted = true;
    const html = renderToStaticMarkup(<UniversityLeaderboard />);

    expect(html).toContain("Permanent Campus Affiliation");
    expect(html).not.toContain("Change Affiliation");
    expect(html).toContain("Representing");
    expect(html).toContain("View Roster");
    expect(html).not.toContain("Join Campus");
  });

  it("allows Change Affiliation and Join Campus when profile is not completed", () => {
    state.me.profileCompleted = false;
    const html = renderToStaticMarkup(<UniversityLeaderboard />);

    expect(html).toContain("Change Affiliation");
    expect(html).not.toContain("Permanent Campus Affiliation");
    expect(html).toContain("Join Campus");
  });
});
