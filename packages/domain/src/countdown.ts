import { jerusalemInstant, type IsoDate } from "./dates";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}

export function countdownTarget(eventDate: IsoDate | null, eventTime: string | null): Date | null {
  return eventDate ? jerusalemInstant(eventDate, eventTime) : null;
}

export function countdown(target: Date, now: Date = new Date()): Countdown {
  const diffMin = Math.floor((target.getTime() - now.getTime()) / 60_000);
  if (diffMin <= 0) return { days: 0, hours: 0, minutes: 0, isPast: true };
  return {
    days: Math.floor(diffMin / 1440),
    hours: Math.floor((diffMin % 1440) / 60),
    minutes: diffMin % 60,
    isPast: false,
  };
}
