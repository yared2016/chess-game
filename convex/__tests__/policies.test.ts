import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("Authoritative Legal Documents & Policies Management Subsystem", () => {
  test("getPublishedPolicy returns fallback content when no db override exists", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const terms = await as(t, alice).query(api.policies.getPublishedPolicy, { slug: "terms" });
    expect(terms).not.toBeNull();
    expect(terms!.slug).toBe("terms");
    expect(terms!.version).toBe("4.2.7-PROD");
    expect(terms!.content).toContain("Abay Chess — Terms of Service");

    const privacy = await as(t, alice).query(api.policies.getPublishedPolicy, { slug: "privacy" });
    expect(privacy).not.toBeNull();
    expect(privacy!.slug).toBe("privacy");
    expect(privacy!.version).toBe("4.2.7-PROD");
    expect(privacy!.content).toContain("Abay Chess — Privacy Policy");

    const payments = await as(t, alice).query(api.policies.getPublishedPolicy, { slug: "payments" });
    expect(payments).not.toBeNull();
    expect(payments!.slug).toBe("payments");
    expect(payments!.content).toContain("Payment & Payout Policy");
    expect(payments!.content).toContain("Net Withdrawal Guarantee");

    const licenses = await as(t, alice).query(api.policies.getPublishedPolicy, { slug: "licenses" });
    expect(licenses).not.toBeNull();
    expect(licenses!.slug).toBe("licenses");
    expect(licenses!.content).toContain("Open Source Licenses & Legal Attributions");
  });

  test("recordPolicyAcceptance records player acceptance in policyAcceptances and players table", async () => {
    const t = makeTest();
    const bob = await signUp(t, "bob");

    const result = await as(t, bob).mutation(api.policies.recordPolicyAcceptance, {
      termsVersion: "4.2.7-PROD",
      privacyVersion: "4.2.7-PROD",
    });

    expect(result.success).toBe(true);
    expect(result.acceptedAt).toBeGreaterThan(0);

    // Verify player doc was updated
    await t.run(async (ctx) => {
      const player = await ctx.db.get(bob.id);
      expect(player?.acceptedTermsVersion).toBe("4.2.7-PROD");
      expect(player?.acceptedPrivacyVersion).toBe("4.2.7-PROD");
      expect(player?.acceptedPoliciesAt).toBe(result.acceptedAt);

      const acceptances = await ctx.db
        .query("policyAcceptances")
        .withIndex("by_playerId", (q) => q.eq("playerId", bob.id))
        .collect();
      expect(acceptances.length).toBe(1);
      expect(acceptances[0].termsVersion).toBe("4.2.7-PROD");
      expect(acceptances[0].privacyVersion).toBe("4.2.7-PROD");
    });
  });

  test("listPublishedPolicies returns all 4 published legal policies", async () => {
    const t = makeTest();
    const charlie = await signUp(t, "charlie");

    const list = await as(t, charlie).query(api.policies.listPublishedPolicies, {});
    expect(list.length).toBe(4);
    const slugs = list.map((p: any) => p.slug);
    expect(slugs).toEqual(["terms", "privacy", "payments", "licenses"]);
  });
});
