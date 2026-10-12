import { expect, test } from "@playwright/test";
import { collectPageErrors, seedEvent, signUp } from "./helpers";

test("who paid: default from the event, other payers by name, filter in expenses", async ({ page }) => {
  const errors = collectPageErrors(page);
  await signUp(page);
  // Two grooms; most payments come from the joint account. The seeded payment has no payer yet.
  const { eventId } = await seedEvent(page, {
    partner1Name: "דן",
    partner2Name: "יואב",
    partner1Role: "groom",
    partner2Role: "groom",
    defaultPayer: "joint",
  });

  await page.goto(`/e/${eventId}/contracts`);
  await page
    .getByRole("button", { name: /גני הוורדים/ })
    .first()
    .click();
  await page.getByRole("button", { name: "תשלומים ומועדים" }).click();
  await page.getByRole("button", { name: "הוספת תשלום" }).click();

  const payer = page.locator("#payer");
  await expect(payer).toHaveValue("joint");
  await expect(payer.locator("option", { hasText: "ההורים של יואב" })).toHaveCount(1);
  await payer.selectOption("other");
  await page.locator("#payerName").fill("סבתא רחל");
  await page.locator("#amount").fill("5000");
  await page.getByRole("button", { name: "שמירת תשלום" }).click();
  // "When is the next payment?" — the seeded balance installment is already planned.
  await page.getByRole("button", { name: /^(אישור|אין עדיין)$/ }).click();

  // The older payment shows "not recorded" and can be assigned now.
  await page.getByRole("button", { name: "לא צוין" }).click();
  await page.getByRole("dialog", { name: "מי שילם?" }).locator("select").selectOption("partner1");
  await page.getByRole("dialog", { name: "מי שילם?" }).getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText("עודכן מי שילם")).toBeVisible();
  await expect(page.getByRole("button", { name: "החשבון של דן" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`/e/${eventId}/expenses`);
  const filter = page.getByRole("group", { name: "מי שילם" });
  await expect(filter.getByRole("button", { name: /החשבון של דן/ })).toBeVisible();
  await filter.getByRole("button", { name: /סבתא רחל/ }).click();
  await expect(filter.getByRole("button", { name: /סבתא רחל/ })).toHaveAttribute("aria-pressed", "true");
  // Only what grandma paid towards the venue.
  await expect(page.locator("table td.text-success")).toHaveText([/(^|[^\d,])5,000(?!\d)/]);

  expect(errors).toEqual([]);
});
