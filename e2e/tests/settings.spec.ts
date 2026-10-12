import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { WEB } from "../urls";
import { collectPageErrors, PASSWORD, seedEvent, signUp } from "./helpers";

test("profile, devices, password, export and account deletion", async ({ page, browser }) => {
  const errors = collectPageErrors(page);
  const email = await signUp(page);
  await seedEvent(page);

  // A second device for the same user.
  const other = await browser.newContext();
  const signIn = await other.request.post("/v1/auth/sign-in/email", {
    headers: { origin: WEB },
    data: { email, password: PASSWORD },
  });
  expect(signIn.ok()).toBe(true);

  await page.goto("/");
  await page.waitForURL(/\/e\//);
  await page.getByRole("button", { name: "תפריט משתמש" }).click();
  await page.getByRole("menuitem", { name: "הגדרות החשבון" }).click();
  await page.waitForURL("**/settings");

  // Profile
  await page.locator("#phone").fill("123");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText("מספר טלפון לא תקין")).toBeVisible();
  await page.locator("#name").fill("מיכל לוי");
  await page.locator("#phone").fill("050 123 4567");
  await page.getByText("אני מסכים/ה לקבל תזכורות תשלום בוואטסאפ").click();
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText("הפרטים נשמרו")).toBeVisible();
  await expect(page.locator("#phone")).toHaveValue("050-123-4567");
  const me = await (await page.request.get("/v1/me")).json();
  expect(me).toMatchObject({ name: "מיכל לוי", phoneE164: "+972501234567" });
  expect(me.whatsappOptInAt).toBeTruthy();

  // Devices: sign the other one out.
  const devices = page.locator("li", { hasText: "התחברות:" });
  await expect(devices).toHaveCount(2);
  await expect(page.getByText("המכשיר הזה")).toBeVisible();
  await page.getByRole("button", { name: "ניתוק", exact: true }).click();
  await expect(page.getByText("המכשיר נותק")).toBeVisible();
  await expect(devices).toHaveCount(1);
  expect((await other.request.get("/v1/me")).status()).toBe(401);
  await other.close();

  // Password
  await page.locator("#currentPassword").fill("Wrong1!xx");
  await page.locator("#newPassword").fill("Better2@");
  await page.locator("#confirmPassword").fill("Better2@");
  await page.getByRole("button", { name: "עדכון סיסמה" }).click();
  await expect(page.getByText("הסיסמה הנוכחית לא נכונה")).toBeVisible();
  await page.locator("#currentPassword").fill(PASSWORD);
  await page.getByRole("button", { name: "עדכון סיסמה" }).click();
  await expect(page.getByText("הסיסמה עודכנה").first()).toBeVisible();

  // Export
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "הורדת המידע שלי" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^sagarnu-export-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(data.account.email).toBe(email);
  expect(data.events).toHaveLength(1);
  expect(data.events[0].contracts).toHaveLength(1);

  // Delete the account.
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  const dialog = page.getByRole("dialog");
  const confirmDelete = dialog.getByRole("button", { name: "מחיקה לצמיתות" });
  await expect(confirmDelete).toBeDisabled();
  await dialog.getByText("הבנתי, למחוק את החשבון שלי").click();
  await dialog.locator("#deletePassword").fill(PASSWORD);
  await confirmDelete.click();
  await expect(dialog.getByText("הסיסמה לא נכונה")).toBeVisible();
  await dialog.locator("#deletePassword").fill("Better2@");
  await confirmDelete.click();
  await page.waitForURL((u) => u.pathname === "/login" && u.search === "?deleted=1");
  await expect(page.getByText("החשבון נמחק")).toBeVisible();

  const relogin = await page.request.post("/v1/auth/sign-in/email", {
    headers: { origin: WEB },
    data: { email, password: "Better2@" },
  });
  expect(relogin.status()).toBe(401);

  expect(errors).toEqual([]);
});
