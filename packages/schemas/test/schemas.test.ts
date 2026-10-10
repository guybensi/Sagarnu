import { describe, expect, it } from "vitest";
import { createContractSchema, failedPasswordRules, paymentSchema, signUpSchema } from "../src";

describe("password policy", () => {
  it.each([
    ["Abcdef1!", []],
    ["abcdef1!", ["uppercase"]],
    ["Abcdefg!", ["digit"]],
    ["Abcdefg1", ["special"]],
    ["Ab1!", ["length"]],
  ])("%s", (password, failed) => {
    expect(failedPasswordRules(password)).toEqual(failed);
  });

  it("is enforced on sign-up", () => {
    const base = { name: "דנה", email: "dana@example.com", userType: "couple" as const };
    expect(signUpSchema.safeParse({ ...base, password: "Secret1!" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, password: "secret" }).success).toBe(false);
  });
});

describe("contract input", () => {
  const base = {
    categoryId: "0192a7a0-0000-7000-8000-000000000000",
    status: "approved",
    vendorName: "אולמי הגן",
  };

  it("applies defaults", () => {
    const parsed = createContractSchema.parse(base);
    expect(parsed).toMatchObject({ vatMode: "unknown", pricingType: "fixed", schedule: [] });
  });

  it("only accepts http(s) links", () => {
    expect(createContractSchema.safeParse({ ...base, websiteUrl: "https://a.co.il" }).success).toBe(true);
    expect(createContractSchema.safeParse({ ...base, websiteUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("requires days for relative schedule items", () => {
    const schedule = [{ label: "יתרה", relativeAnchor: "event" }];
    expect(createContractSchema.safeParse({ ...base, schedule }).success).toBe(false);
  });
});

describe("payment input", () => {
  it("rejects zero amounts", () => {
    expect(paymentSchema.safeParse({ amountAgorot: 0, method: "cash", paidOn: "2026-01-01" }).success).toBe(
      false,
    );
  });
});
