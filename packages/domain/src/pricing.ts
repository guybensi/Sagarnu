import type { Agorot } from "./money";

/** Suggested total for per-guest pricing: price × max(guests, minimum). */
export function perGuestTotal(
  pricePerGuest: Agorot,
  guestCount: number | null,
  minGuests: number | null,
): Agorot | null {
  const guests = Math.max(guestCount ?? 0, minGuests ?? 0);
  return guests > 0 ? pricePerGuest * guests : null;
}
