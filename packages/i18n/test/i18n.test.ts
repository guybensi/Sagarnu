import { ERROR_CODES } from "@sagarnu/schemas";
import { describe, expect, it } from "vitest";
import { errorMessage, formatDate, formatILS, he } from "../src";

describe("formatters", () => {
  it("formats shekels from agorot", () => {
    expect(formatILS(1_250_000)).toMatch(/12,500/);
    expect(formatILS(1_250_050)).toMatch(/12,500\.5/);
    expect(formatILS(null)).toBe("—");
  });

  it("formats Israeli dates", () => {
    expect(formatDate("2026-03-07")).toBe("07/03/2026");
  });
});

describe("error messages", () => {
  it("has Hebrew text for every server error code", () => {
    for (const code of ERROR_CODES) expect(he.errors[code]).toBeTruthy();
  });

  it("falls back for unknown codes", () => {
    expect(errorMessage("nope")).toBe(he.errors.internal);
  });
});
