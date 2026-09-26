import { describe, expect, test } from "vitest";
import { formatChessClock } from "../format";

describe("formatChessClock", () => {
  test("formats standard minutes and seconds", () => {
    expect(formatChessClock(5 * 60 * 1000)).toBe("5:00");
    expect(formatChessClock(3 * 60 * 1000)).toBe("3:00");
    expect(formatChessClock(10 * 60 * 1000)).toBe("10:00");
    expect(formatChessClock(65 * 1000)).toBe("1:05");
  });

  test("formats hours when >= 60 minutes", () => {
    expect(formatChessClock(60 * 60 * 1000)).toBe("1:00:00");
    expect(formatChessClock(90 * 60 * 1000)).toBe("1:30:00");
  });

  test("formats seconds when under 1 minute", () => {
    expect(formatChessClock(45 * 1000)).toBe("0:45");
    expect(formatChessClock(15 * 1000)).toBe("0:15");
    expect(formatChessClock(10 * 1000)).toBe("0:10");
  });

  test("formats tenths of a second when under 10 seconds", () => {
    expect(formatChessClock(9500)).toBe("0:09.5");
    expect(formatChessClock(3200)).toBe("0:03.2");
    expect(formatChessClock(800)).toBe("0:00.8");
  });

  test("handles 0 and negative values safely", () => {
    expect(formatChessClock(0)).toBe("0:00.0");
    expect(formatChessClock(-500)).toBe("0:00.0");
  });
});
