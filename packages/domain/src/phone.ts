/** E.164: `+`, country code, up to 15 digits. */
export const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Accepts how people type Israeli numbers ("050-123 4567", "972501234567", "+972 50…") and
 * returns E.164 (`+972501234567`), or null when it is not a phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[+\d\s\-().]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+972")) digits = `+972${digits.slice(4).replace(/^0/, "")}`;
  else if (digits.startsWith("972")) digits = `+972${digits.slice(3).replace(/^0/, "")}`;
  else if (digits.startsWith("0")) digits = `+972${digits.slice(1)}`;
  else if (!digits.startsWith("+")) return null;
  if (digits.startsWith("+972") && !/^\+972[2-9]\d{7,8}$/.test(digits)) return null;
  return E164.test(digits) ? digits : null;
}

/** `+972501234567` → `050-123-4567` for display; other countries stay in E.164. */
export function formatPhone(e164: string): string {
  const m = /^\+972(5\d)(\d{3})(\d{4})$/.exec(e164);
  if (m) return `0${m[1]}-${m[2]}-${m[3]}`;
  const land = /^\+972([2-9])(\d{3})(\d{4})$/.exec(e164);
  if (land) return `0${land[1]}-${land[2]}-${land[3]}`;
  return e164;
}
