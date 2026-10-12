import { expect, test } from "@playwright/test";
import { collectPageErrors, PASSWORD, uniqueEmail } from "./helpers";

test("a planner creates an event and the couple joins through the invitation link", async ({ browser }) => {
  const plannerContext = await browser.newContext();
  const planner = await plannerContext.newPage();
  const plannerErrors = collectPageErrors(planner);

  await planner.goto("/signup");
  await planner.getByRole("radio", { name: /מפיק/ }).click();
  await planner.locator("#name").fill("שירן המפיקה");
  await planner.locator("#email").fill(uniqueEmail("planner"));
  await planner.locator("#password").fill(PASSWORD);
  await planner.getByRole("button", { name: "הרשמה", exact: true }).click();
  await planner.waitForURL("**/events");
  await expect(planner.getByText("עוד אין אירועים")).toBeVisible();

  await planner.getByRole("link", { name: "אירוע חדש" }).first().click();
  await planner.waitForURL("**/onboarding");
  for (let i = 0; i < 3; i++) await planner.getByRole("button", { name: "הבא" }).click();
  await planner.getByLabel("שם בן/בת הזוג הראשון/ה").fill("נועה");
  await planner.getByLabel("שם בן/בת הזוג השני/ה").fill("עידו");
  await planner.getByRole("button", { name: "הבא" }).click();
  await planner.getByRole("button", { name: "הבא" }).click();
  await planner.getByRole("button", { name: "סיימנו, לדשבורד" }).click();
  await planner.waitForURL(/\/members\?invite=1$/);

  const noaEmail = uniqueEmail("noa");
  await planner.locator("#inviteEmail").fill(noaEmail);
  await planner.getByRole("button", { name: "יצירת הזמנה" }).click();
  const inviteUrl = await planner.getByLabel("קישור הזמנה").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{20,}$/);
  await expect(planner.getByRole("link", { name: "שליחה בוואטסאפ" })).toBeVisible();
  await expect(planner.getByText("ממתינים להצטרפות")).toBeVisible();

  // The partner, in a separate browser.
  const noaContext = await browser.newContext();
  const noa = await noaContext.newPage();
  const noaErrors = collectPageErrors(noa);
  const invitePath = new URL(inviteUrl).pathname;
  await noa.goto(invitePath);
  await expect(noa.getByText("שירן המפיקה הזמין/ה אותך")).toBeVisible();
  await expect(noa.getByRole("heading", { name: "החתונה של נועה ועידו" })).toBeVisible();
  await noa.getByRole("button", { name: "הרשמה והצטרפות" }).click();
  await noa.waitForURL(/\/signup\?next=/);
  await noa.locator("#name").fill("נועה");
  await noa.locator("#email").fill(noaEmail);
  await noa.locator("#password").fill(PASSWORD);
  await noa.getByRole("button", { name: "הרשמה", exact: true }).click();
  await noa.waitForURL(/\/invite\//);
  await noa.getByRole("button", { name: "הצטרפות לאירוע" }).click();
  await noa.waitForURL(/\/e\/[^/]+$/);
  await expect(noa.getByText("החתונה של נועה ועידו").first()).toBeVisible();
  await expect(noa.getByRole("link", { name: "שיתוף" })).toHaveCount(0);

  // A link works once.
  await noa.goto(invitePath);
  await expect(noa.getByText("ההזמנה כבר נוצלה")).toBeVisible();

  // The planner sees the new member and changes the role.
  await planner.reload();
  await expect(planner.getByText(noaEmail)).toBeVisible();
  await expect(planner.getByText("ממתינים להצטרפות")).toHaveCount(0);
  await planner.getByLabel("הרשאה של נועה").selectOption("viewer");
  await expect(planner.getByText("נועה: צפייה בלבד")).toBeVisible();

  await planner.goto("/");
  await planner.waitForURL("**/events");
  await expect(planner.getByText("החתונה של נועה ועידו")).toBeVisible();

  expect([...plannerErrors, ...noaErrors]).toEqual([]);
  await plannerContext.close();
  await noaContext.close();
});
