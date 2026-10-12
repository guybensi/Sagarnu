import { expect, test } from "@playwright/test";
import { collectPageErrors, seedEvent, signUp } from "./helpers";

test("add a contract by hand, pay an installment and see it in expenses", async ({ page }) => {
  const errors = collectPageErrors(page);
  await signUp(page);
  const { eventId } = await seedEvent(page);

  await page.goto(`/e/${eventId}/contracts`);
  await page.getByRole("button", { name: "חוזה חדש" }).first().click();
  await page.getByRole("button", { name: /הזנה ידנית/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("שם הספק").fill("צלמי השמחה");
  await dialog.locator("#total").fill("12000");
  await dialog.locator("[id^=schedule-][id$=-amount]").last().fill("3000");
  await dialog.locator("[id^=schedule-][id$=-date]").last().fill("2026-12-01");
  await dialog.getByRole("button", { name: "שמירה" }).click();

  // Saving opens the vendor panel with the schedule.
  await expect(page.getByText("מועדי תשלום")).toBeVisible();
  await page.getByRole("button", { name: "סמן כשולם" }).first().click();
  await page.getByRole("button", { name: "שמירת תשלום" }).click();
  await expect(page.getByText("מתי התשלום הבא?")).toBeVisible();
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText("מתי התשלום הבא?")).toBeHidden();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "הוצאות" }).first().click();
  await expect(page.getByText("סה״כ חוזים")).toBeVisible();
  await expect(page.getByText("צלמי השמחה").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("an existing contract opens locked and saves edits together", async ({ page }) => {
  const errors = collectPageErrors(page);
  await signUp(page);
  const { eventId, contractId } = await seedEvent(page);

  await page.goto(`/e/${eventId}/contracts`);
  await page
    .getByRole("button", { name: /גני הוורדים/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("צפייה בלבד")).toBeVisible();
  await expect(dialog.locator("#vendorName")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "הוספת מועד" })).toHaveCount(0);

  // Relative installment shows the date it falls on (7 days before 2027-05-20).
  await expect(dialog.getByText("13/05/2027")).toBeVisible();

  // Cancel reverts.
  await dialog.getByRole("button", { name: "עריכה" }).click();
  await expect(dialog.locator("#vendorName")).toBeEnabled();
  await dialog.locator("#vendorName").fill("שם זמני");
  await dialog.getByRole("button", { name: "ביטול" }).click();
  await expect(dialog.locator("#vendorName")).toHaveValue("גני הוורדים");
  await expect(dialog.locator("#vendorName")).toBeDisabled();

  // Edit total, add an installment and leave "approved" (asks for confirmation).
  await dialog.getByRole("button", { name: "עריכה" }).click();
  await dialog.locator("#total").fill("100000");
  await dialog.getByRole("button", { name: "הוספת מועד" }).click();
  await dialog.locator("[id^=schedule-][id$=-amount]").last().fill("5000");
  await dialog.locator("[id^=schedule-][id$=-date]").last().fill("2027-01-15");
  await dialog.getByRole("button", { name: "במשא ומתן", exact: true }).click();
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await page.getByRole("button", { name: "כן, לשנות" }).click();
  await expect(page.getByText("החוזה עודכן")).toBeVisible();
  await expect(dialog.locator("#vendorName")).toBeDisabled();

  const saved = await (await page.request.get(`/v1/events/${eventId}/contracts/${contractId}`)).json();
  expect(saved.totalAmountAgorot).toBe(10_000_000);
  expect(saved.status).toBe("negotiating");
  expect(saved.schedule).toHaveLength(3);

  expect(errors).toEqual([]);
});

test("main screens fit a phone screen without sideways scrolling", async ({ page }) => {
  await signUp(page);
  const { eventId } = await seedEvent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["", "/contracts", "/expenses", "/details"]) {
    await page.goto(`/e/${eventId}${path}`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal scroll on /e/:id${path}`).toBe(false);
  }
});

test("a contract file uploads with a new contract and opens from the contract", async ({ page }) => {
  const errors = collectPageErrors(page);
  await signUp(page);
  const { eventId } = await seedEvent(page);

  await page.goto(`/e/${eventId}/contracts`);
  await page.getByRole("button", { name: "חוזה חדש" }).first().click();
  await page.getByRole("button", { name: /הזנה ידנית/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("שם הספק").fill("די ג'יי רון");
  await dialog.getByLabel("העלאת קובץ").setInputFiles({
    name: "חוזה די ג'יי.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF"),
  });
  await expect(dialog.getByText("חוזה די ג'יי.pdf")).toBeVisible();
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { name: "מועדי תשלום" })).toBeVisible();

  // The vendor panel links to the file; the contract (view mode) has "view contract".
  const link = page.getByRole("link", { name: "חוזה די ג'יי.pdf" });
  await expect(link).toBeVisible();
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /די ג'יי רון/ })
    .first()
    .click();
  const view = page.getByRole("dialog").getByRole("link", { name: "צפייה בחוזה" });
  await expect(view).toBeVisible();

  expect(errors).toEqual([]);
});
