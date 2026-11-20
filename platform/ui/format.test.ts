import { describe, expect, it } from "vitest";
import { parseDollarsToCents } from "./format";

describe("parseDollarsToCents", () => {
  it("parses plain and thousands-separated amounts", () => {
    expect(parseDollarsToCents("12.34")).toBe(1234);
    expect(parseDollarsToCents("$1,250.5")).toBe(125050);
  });

  it("rejects misplaced commas and malformed input", () => {
    for (const bad of ["125,50", "1,25", "12,3456", "1.234", "abc", ""]) {
      expect(parseDollarsToCents(bad)).toBeNull();
    }
  });
});
