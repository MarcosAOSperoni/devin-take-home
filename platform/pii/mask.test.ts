import { describe, expect, it } from "vitest";
import { mask } from "./mask";

describe("mask", () => {
  it("shows only the last N characters", () => {
    expect(mask("900-12-3456", { showLast: 4 })).toBe("*******3456");
  });
  it("defaults to showing the last 4", () => {
    expect(mask("12345678")).toBe("****5678");
  });
  it("fully masks values no longer than showLast", () => {
    expect(mask("123", { showLast: 4 })).toBe("***");
  });
  it("can mask everything", () => {
    expect(mask("secret", { showLast: 0 })).toBe("******");
  });
  it("returns empty string for empty input", () => {
    expect(mask("")).toBe("");
    expect(mask(null)).toBe("");
  });
});
