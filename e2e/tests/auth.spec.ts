import { expect, test } from "@playwright/test";
import { collectPageErrors, PASSWORD, uniqueEmail } from "./helpers";

test("a couple signs up, fills the questionnaire and reaches the dashboard", async ({ page }) => {
  const errors = collectPageErrors(page);
  const email = uniqueEmail("couple");

  await page.goto("/signup");
  await page.getByLabel("שם", { exact: true }).fill("מיכל");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "הרשמה", exact: true }).click();
  await page.waitForURL("**/onboarding");

  await page.getByLabel("תאריך האירוע").fill("2027-05-20");
  await page.getByLabel("שעת התחלה").fill("19:00");
  await page.getByRole("button", { name: "הבא" }).click();
  await page.getByLabel("מספר מוזמנים משוער").fill("280");
  await page.locator("#estimatedBudgetAgorot").fill("180,000");
  await page.getByRole("button", { name: "הבא" }).click();
  await page.getByLabel("עיר / אזור").fill("ראשון לציון");
  await page.getByLabel("שם האולם / המקום").fill("גני הוורדים");
  await page.getByRole("button", { name: "הבא" }).click();
  await page.getByLabel("שם בן/בת הזוג הראשון/ה").fill("מיכל");
  await page.getByLabel("שם בן/בת הזוג השני/ה").fill("אורי");
  await page.getByRole("button", { name: "הבא" }).click();
  await page.getByRole("button", { name: "גן אירועים" }).click();
  await page.getByRole("button", { name: "הבא" }).click();
  await page.getByRole("button", { name: "סיימנו, לדשבורד" }).click();

  await page.waitForURL(/\/e\/[^/]+$/);
  await expect(page.getByText("התשלום הקרוב")).toBeVisible();
  await expect(page.getByText("מצב התקציב")).toBeVisible();

  // Log out from the user menu, then back in.
  await page.getByRole("button", { name: "תפריט משתמש" }).click();
  await page.getByRole("menuitem", { name: "התנתקות" }).click();
  await page.waitForURL("**/login");

  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Wrong1!xx");
  await page.getByRole("button", { name: "התחברות", exact: true }).click();
  await expect(page.getByText("לא מצאנו חשבון עם האימייל והסיסמה האלה")).toBeVisible();

  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "התחברות", exact: true }).click();
  await page.waitForURL(/\/e\/[^/]+$/);
  await expect(page.getByText("מצב התקציב")).toBeVisible();

  expect(errors).toEqual([]);
});

test("pages that need a session send guests to login", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForURL(/\/login/);
  await expect(page.getByRole("heading", { name: "התחברות" })).toBeVisible();
});
