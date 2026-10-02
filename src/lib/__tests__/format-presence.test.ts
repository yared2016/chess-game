import { describe, expect, test } from "vitest";
import { formatPresenceLastSeen } from "../format";

describe("formatPresenceLastSeen", () => {
  // Fixed reference time: Oct 8, 2026, 12:00:00 UTC
  const fixedNow = Date.UTC(2026, 9, 8, 12, 0, 0);

  test("returns 'Offline' when lastSeenMs is 0 or unrecorded", () => {
    expect(formatPresenceLastSeen(0, fixedNow)).toBe("Offline");
    expect(formatPresenceLastSeen(-1, fixedNow)).toBe("Offline");
  });

  test("returns 'Online' for offsets under 1 minute (< 60,000 ms)", () => {
    // 0 ms offset
    expect(formatPresenceLastSeen(fixedNow, fixedNow)).toBe("Online");
    // 30 seconds ago
    expect(formatPresenceLastSeen(fixedNow - 30_000, fixedNow)).toBe("Online");
    // 59.9 seconds ago
    expect(formatPresenceLastSeen(fixedNow - 59_900, fixedNow)).toBe("Online");
  });

  test("returns 'Last seen 1 min ago' for 1 minute offset", () => {
    // exactly 60s
    expect(formatPresenceLastSeen(fixedNow - 60_000, fixedNow)).toBe("Last seen 1 min ago");
    // 75 seconds ago
    expect(formatPresenceLastSeen(fixedNow - 75_000, fixedNow)).toBe("Last seen 1 min ago");
    // 119 seconds ago
    expect(formatPresenceLastSeen(fixedNow - 119_000, fixedNow)).toBe("Last seen 1 min ago");
  });

  test("returns 'Last seen 5 min ago' for 5 minutes offset", () => {
    expect(formatPresenceLastSeen(fixedNow - 5 * 60_000, fixedNow)).toBe("Last seen 5 min ago");
  });

  test("returns 'Last seen 1 hour ago' for 1 hour offset", () => {
    // exactly 1 hour
    expect(formatPresenceLastSeen(fixedNow - 3_600_000, fixedNow)).toBe("Last seen 1 hour ago");
    // 1 hour 15 minutes
    expect(formatPresenceLastSeen(fixedNow - 75 * 60_000, fixedNow)).toBe("Last seen 1 hour ago");
  });

  test("returns 'Last seen 5 hours ago' for 5 hours offset", () => {
    expect(formatPresenceLastSeen(fixedNow - 5 * 3_600_000, fixedNow)).toBe("Last seen 5 hours ago");
    // 23 hours ago
    expect(formatPresenceLastSeen(fixedNow - 23 * 3_600_000, fixedNow)).toBe("Last seen 23 hours ago");
  });

  test("returns 'Last seen yesterday' for 24 hours to 48 hours offset", () => {
    // exactly 24 hours (86_400_000 ms)
    expect(formatPresenceLastSeen(fixedNow - 24 * 3_600_000, fixedNow)).toBe("Last seen yesterday");
    // 30 hours
    expect(formatPresenceLastSeen(fixedNow - 30 * 3_600_000, fixedNow)).toBe("Last seen yesterday");
    // 47 hours
    expect(formatPresenceLastSeen(fixedNow - 47 * 3_600_000, fixedNow)).toBe("Last seen yesterday");
  });

  test("returns 'Last seen <Month Day>' for multiple days ago in the same year", () => {
    // 7 days ago: Oct 1, 2026
    const sevenDaysAgo = fixedNow - 7 * 86_400_000;
    expect(formatPresenceLastSeen(sevenDaysAgo, fixedNow)).toBe("Last seen Oct 1");

    // 2 days ago: Oct 6, 2026
    const twoDaysAgo = fixedNow - 2 * 86_400_000;
    expect(formatPresenceLastSeen(twoDaysAgo, fixedNow)).toBe("Last seen Oct 6");
  });

  test("returns 'Last seen <Month Day, Year>' for past years", () => {
    const lastYear = Date.UTC(2025, 9, 2, 12, 0, 0);
    expect(formatPresenceLastSeen(lastYear, fixedNow)).toBe("Last seen Oct 2, 2025");
  });

  test("defaults to Date.now() when nowMs is omitted", () => {
    const justNow = Date.now() - 5_000;
    expect(formatPresenceLastSeen(justNow)).toBe("Online");
  });
});
