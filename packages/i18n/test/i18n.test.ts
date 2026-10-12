import { ERROR_CODES } from "@sagarnu/schemas";
import { describe, expect, it } from "vitest";
import { errorMessage, formatDate, formatILS, he, partnerName, payerLabel, payerLabels } from "../src";

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

describe("partners and payers", () => {
  const none = { partner1Name: null, partner2Name: null, partner1Role: null, partner2Role: null };

  it("uses names first, then the chosen role, then a neutral label", () => {
    expect(partnerName({ ...none, partner1Name: "נועה", partner1Role: "bride" }, 1)).toBe("נועה");
    expect(partnerName({ ...none, partner1Role: "groom", partner2Role: "bride" }, 1)).toBe("החתן");
    expect(partnerName({ ...none, partner1Role: "bride", partner2Role: "bride" }, 2)).toBe("כלה 2");
    expect(partnerName(none, 1)).toBe("בן/בת זוג 1");
  });

  it("names the payer options after the couple", () => {
    const couple = { ...none, partner1Name: "דן", partner2Name: "יואב", partner1Role: "groom" as const };
    expect(payerLabels(couple)).toMatchObject({
      partner1: "החשבון של דן",
      partner2_parents: "ההורים של יואב",
    });
    expect(payerLabel(couple, "other", "סבתא רחל")).toBe("סבתא רחל");
    expect(payerLabel(couple, null, null)).toBe("לא צוין");
  });
});
