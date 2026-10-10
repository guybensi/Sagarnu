import { TZDate } from "@date-fns/tz";

export const TIME_ZONE = "Asia/Jerusalem";

/** A calendar day as `yyyy-MM-dd`. Day-only values never carry a time zone. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
  const m = ISO_DATE.exec(value);
  if (!m) throw new Error(`invalid ISO date: ${value}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1;
}

/** Today's date in Israel. */
export function todayIso(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function addDaysIso(value: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Converts a local Israel date + `HH:mm` time into an absolute instant (DST-aware). */
export function jerusalemInstant(date: IsoDate, time: string | null = null): Date {
  const { year, month, day } = parseIsoDate(date);
  const [h = 0, min = 0] = (time ?? "00:00").split(":").map(Number);
  return new Date(new TZDate(year, month - 1, day, h, min, TIME_ZONE).getTime());
}
