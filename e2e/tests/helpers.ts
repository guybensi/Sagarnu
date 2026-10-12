import { expect, type Page } from "@playwright/test";
import { WEB } from "../urls";

export const PASSWORD = "Secret1!";

export function uniqueEmail(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Signs a new user up through the API; the session cookie lands in the page's browser context. */
export async function signUp(
  page: Page,
  { name = "מיכל", userType = "couple" as "couple" | "planner" } = {},
) {
  const email = uniqueEmail(userType);
  const res = await page.request.post("/v1/auth/sign-up/email", {
    headers: { origin: WEB },
    data: { name, email, password: PASSWORD, userType },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return email;
}

async function call<T>(page: Page, method: "GET" | "POST", path: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(path, { method, data });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** Event with guests and budget, one approved contract with two installments, the first one paid. */
export async function seedEvent(page: Page) {
  const event = await call<{ id: string }>(page, "POST", "/v1/events", {
    name: "החתונה של מיכל ואורי",
    eventDate: "2027-05-20",
    eventTime: "19:00",
    guestCount: 280,
    estimatedBudgetAgorot: 18_000_000,
    venueName: "גני הוורדים",
    city: "ראשון לציון",
  });
  const categories = await call<{ id: string; key: string }[]>(
    page,
    "GET",
    `/v1/events/${event.id}/categories`,
  );
  const contract = await call<{ id: string; schedule: { id: string }[] }>(
    page,
    "POST",
    `/v1/events/${event.id}/contracts`,
    {
      categoryId: categories.find((c) => c.key === "venue")!.id,
      status: "approved",
      vendorName: "גני הוורדים",
      vendorContactName: "דנה",
      totalAmountAgorot: 9_500_000,
      vatMode: "included",
      signedOn: "2026-09-01",
      schedule: [
        { label: "מקדמה", amountAgorot: 2_000_000, dueDate: "2026-09-01" },
        { label: "יתרה", percent: 50, relativeAnchor: "event", relativeDays: -7 },
      ],
    },
  );
  await call(page, "POST", `/v1/events/${event.id}/contracts/${contract.id}/payments`, {
    amountAgorot: 2_000_000,
    method: "bank_transfer",
    paidOn: "2026-09-01",
    scheduleItemId: contract.schedule[0]!.id,
  });
  return { eventId: event.id, contractId: contract.id };
}

/** Fails the test on uncaught exceptions in the page. */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
