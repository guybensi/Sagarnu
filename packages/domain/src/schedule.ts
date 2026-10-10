import { addDaysIso, type IsoDate } from "./dates";
import type { RelativeAnchor } from "./enums";
import type { Agorot } from "./money";

export interface ScheduleTiming {
  dueDate: IsoDate | null;
  relativeAnchor: RelativeAnchor | null;
  relativeDays: number | null;
}

export interface ScheduleAnchors {
  signingDate: IsoDate | null;
  eventDate: IsoDate | null;
}

/** Relative items ("7 days before the event") win over a stored date, so they follow date changes. */
export function resolveDueDate(item: ScheduleTiming, anchors: ScheduleAnchors): IsoDate | null {
  if (item.relativeAnchor && item.relativeDays != null) {
    const anchor = item.relativeAnchor === "event" ? anchors.eventDate : anchors.signingDate;
    if (anchor) return addDaysIso(anchor, item.relativeDays);
  }
  return item.dueDate;
}

export function resolveScheduleAmount(
  item: { amountAgorot: Agorot | null; percent: number | null },
  contractTotal: Agorot | null,
): Agorot | null {
  if (item.amountAgorot != null) return item.amountAgorot;
  if (item.percent != null && contractTotal != null) return Math.round((contractTotal * item.percent) / 100);
  return null;
}
