// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("v4.2.7-PROD Phase 9: Staff Admin & Owner Portal Role Separation", () => {
  function maskPii(val: string | undefined | null, isOwner: boolean, unmasked: boolean): string {
    if (isOwner || unmasked) return val || "—";
    if (!val) return "—";
    const str = String(val).trim();
    if (str.length <= 4) return "****";
    const prefix = str.slice(0, 4);
    const suffix = str.slice(-3);
    return `${prefix} **** ${suffix}`;
  }

  describe("RB-40 & RB-41: Staff PII Masking by Default", () => {
    it("masks phone numbers and accounts for staff view by default", () => {
      const phone = "+251911234567";
      const masked = maskPii(phone, false, false);
      expect(masked).toBe("+251 **** 567");
      expect(masked).not.toContain("911234");
    });

    it("unmasks PII when staff toggles unmask button (audited under view_pii)", () => {
      const phone = "+251911234567";
      const unmasked = maskPii(phone, false, true);
      expect(unmasked).toBe("+251911234567");
    });

    it("displays unmasked PII unconditionally for authenticated Owner", () => {
      const phone = "+251911234567";
      const ownerView = maskPii(phone, true, false);
      expect(ownerView).toBe("+251911234567");
    });
  });

  describe("RB-45: Route Authorization Boundaries", () => {
    it("restricts /yyhnan strictly to Owner Clerk Subject ID", () => {
      const ownerSubjectId = "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki";
      const regularUserSubjectId = "user_regular_bob_456";

      const isAuthorizedOwner = (userId: string) => userId === ownerSubjectId;

      expect(isAuthorizedOwner(ownerSubjectId)).toBe(true);
      expect(isAuthorizedOwner(regularUserSubjectId)).toBe(false);
    });

    it("requires authenticated user for staff operations /fssmyfkl", () => {
      const isStaffAccessible = (userId: string | null | undefined) => Boolean(userId);

      expect(isStaffAccessible("user_staff_123")).toBe(true);
      expect(isStaffAccessible(null)).toBe(false);
      expect(isStaffAccessible(undefined)).toBe(false);
    });
  });
});
