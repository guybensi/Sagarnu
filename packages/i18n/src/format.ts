import { parseIsoDate, TIME_ZONE, type Agorot, type IsoDate } from "@sagarnu/domain";

const ils = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const number = new Intl.NumberFormat("he-IL");

export function formatILS(value: Agorot | null | undefined, fallback = "—"): string {
  return value == null ? fallback : ils.format(value / 100);
}

export function formatNumber(value: number | null | undefined, fallback = "—"): string {
  return value == null ? fallback : number.format(value);
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`. */
export function formatDate(value: IsoDate | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const { year, month, day } = parseIsoDate(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** Short form for compact UI: `12/03`. */
export function formatDayMonth(value: IsoDate): string {
  return formatDate(value).slice(0, 5);
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
