import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  groundTruthKeys,
  scheduleItemKeys,
  validateContractGroundTruth,
} from "../scripts/contract-ground-truth";

const template = JSON.parse(
  readFileSync(new URL("../contracts/contract_template.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

// Not real data — synthetic values only, to exercise the validator.
const filled = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...template,
  vendorName: "ספק לדוגמה",
  totalAmountAgorot: 1_000_000,
  ...overrides,
});
const item = (overrides: Record<string, unknown> = {}) => ({
  label: "מקדמה",
  amountAgorot: null,
  percent: null,
  dueDate: null,
  relativeAnchor: null,
  relativeDays: null,
  ...overrides,
});

describe("contract template", () => {
  it("has exactly the ground-truth fields, in schema order", () => {
    expect(Object.keys(template)).toEqual(groundTruthKeys());
  });

  it("only fails on the one required field left blank", () => {
    const result = validateContractGroundTruth(template);
    expect(result.issues.filter((i) => i.level === "error").map((i) => i.path)).toEqual(["vendorName"]);
  });
});

describe("validator", () => {
  it("accepts a complete label", () => {
    const result = validateContractGroundTruth(
      filled({
        signedOn: "2026-05-01",
        schedule: [
          item({ percent: 30, dueDate: "2026-05-01" }),
          item({ label: "יתרה", percent: 70, relativeAnchor: "event", relativeDays: -7 }),
        ],
      }),
    );
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("requires every field to be explicit and rejects unknown or internal keys", () => {
    const { signedOn: _omit, ...missing } = filled();
    const result = validateContractGroundTruth({
      ...missing,
      totalAmount: 5,
      categoryId: "x",
      schedule: [{ ...item(), source: "manual" }],
    });
    const errors = result.issues.filter((i) => i.level === "error").map((i) => `${i.path}: ${i.message}`);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^signedOn: missing/),
        "totalAmount: unknown field",
        "categoryId: unknown field",
        "schedule[0].source: app-internal field, not part of the ground truth",
      ]),
    );
  });

  it("enforces the app's own rules (agorot integers, ISO dates, relative days)", () => {
    const result = validateContractGroundTruth(
      filled({
        totalAmountAgorot: 12500.5,
        signedOn: "01/05/2026",
        schedule: [item({ relativeAnchor: "event" })],
      }),
    );
    const paths = result.issues.filter((i) => i.level === "error").map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(["totalAmountAgorot", "signedOn", "schedule[0].relativeDays"]),
    );
  });

  it("warns when installments do not add up to the total", () => {
    const result = validateContractGroundTruth(
      filled({ schedule: [item({ amountAgorot: 300_000 }), item({ label: "יתרה", amountAgorot: 600_000 })] }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({ level: "warning", path: "schedule", message: expect.stringMatching(/9000/) }),
    ]);
  });

  it("warns about invisible direction marks in Hebrew text", () => {
    const rlm = String.fromCharCode(0x200f);
    const result = validateContractGroundTruth(filled({ vendorName: `גני הוורדים${rlm}` }));
    expect(result.issues).toEqual([expect.objectContaining({ level: "warning", path: "vendorName" })]);
  });

  it("knows the schedule item fields", () => {
    expect(scheduleItemKeys()).toEqual([
      "label",
      "amountAgorot",
      "percent",
      "dueDate",
      "relativeAnchor",
      "relativeDays",
    ]);
  });
});
