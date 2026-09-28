// convex/__tests__/feedback-schema.test.ts
import { describe, expect, it } from "vitest";
import {
  vFeedbackCategory,
  vFeedbackStatus,
  vEmailStatus,
  vFeedbackAttachment,
} from "../lib/validators";
import schema from "../schema";

interface UnionValidator {
  members?: Array<{ value: string }>;
}

interface ObjectValidator {
  fields: Record<string, { kind: string; tableName?: string }>;
}

interface TableSchema {
  indexes: Array<{ indexDescriptor: string }>;
}

describe("Feedback Schema & Validators", () => {
  it("defines all 9 feedback categories in vFeedbackCategory", () => {
    const expectedCategories = [
      "chess_game",
      "matchmaking",
      "tournaments",
      "wallet_payments",
      "account_profile",
      "website_app",
      "feature_request",
      "report_problem",
      "general_feedback",
    ];

    expect(vFeedbackCategory).toBeDefined();
    const members = (vFeedbackCategory as unknown as UnionValidator).members?.map((m) => m.value);
    expect(members).toBeDefined();
    expect(members).toHaveLength(expectedCategories.length);
    for (const cat of expectedCategories) {
      expect(members).toContain(cat);
    }
  });

  it("defines all 4 feedback statuses in vFeedbackStatus", () => {
    const expectedStatuses = ["NEW", "IN_REVIEW", "RESOLVED", "CLOSED"];

    expect(vFeedbackStatus).toBeDefined();
    const members = (vFeedbackStatus as unknown as UnionValidator).members?.map((m) => m.value);
    expect(members).toBeDefined();
    expect(members).toHaveLength(expectedStatuses.length);
    for (const status of expectedStatuses) {
      expect(members).toContain(status);
    }
  });

  it("defines all 3 email statuses in vEmailStatus", () => {
    const expectedEmailStatuses = ["NOT_SENT", "SENT", "FAILED"];

    expect(vEmailStatus).toBeDefined();
    const members = (vEmailStatus as unknown as UnionValidator).members?.map((m) => m.value);
    expect(members).toBeDefined();
    expect(members).toHaveLength(expectedEmailStatuses.length);
    for (const emailStatus of expectedEmailStatuses) {
      expect(members).toContain(emailStatus);
    }
  });

  it("defines vFeedbackAttachment with required fields", () => {
    expect(vFeedbackAttachment).toBeDefined();
    const fields = (vFeedbackAttachment as unknown as ObjectValidator).fields;
    expect(fields).toBeDefined();
    expect(fields.storageId.kind).toBe("id");
    expect(fields.storageId.tableName).toBe("_storage");
    expect(fields.fileName.kind).toBe("string");
    expect(fields.fileType.kind).toBe("string");
    expect(fields.fileSize.kind).toBe("float64");
    expect(fields.uploadedAt.kind).toBe("float64");
  });

  it("defines feedback table in schema with expected indexes", () => {
    expect(schema.tables.feedback).toBeDefined();
    const feedbackTable = (schema.tables as unknown as Record<string, TableSchema>).feedback;
    const indexNames = feedbackTable.indexes.map((idx) => idx.indexDescriptor);
    expect(indexNames).toContain("by_userId");
    expect(indexNames).toContain("by_status");
    expect(indexNames).toContain("by_category");
    expect(indexNames).toContain("by_createdAt");
    expect(indexNames).toContain("by_status_and_createdAt");
  });
});
