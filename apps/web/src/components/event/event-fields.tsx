"use client";

import { CEREMONY_TYPES, EVENT_STYLES, KASHRUT_LEVELS, timeOfDayFor, TIMES_OF_DAY } from "@sagarnu/domain";
import { Moon, Sun } from "lucide-react";
import { he } from "@sagarnu/i18n";
import type { CreateEventInput } from "@sagarnu/schemas";
import type { ReactNode } from "react";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/cn";

export type EventForm = Required<
  Omit<CreateEventInput, "relevantCategoryKeys" | "customCategories" | "completeQuestionnaire">
>;

export const emptyEventForm: EventForm = {
  name: "",
  eventDate: null,
  eventTime: null,
  guestCount: null,
  estimatedBudgetAgorot: null,
  city: null,
  venueName: null,
  venueAddress: null,
  partner1Name: null,
  partner2Name: null,
  eventStyle: null,
  ceremonyType: null,
  kashrut: null,
  timeOfDay: null,
  notes: null,
};

export interface FieldProps {
  form: EventForm;
  set: <K extends keyof EventForm>(key: K, value: EventForm[K]) => void;
  /** Keys the user marked "not known yet". */
  unknown: Set<keyof EventForm>;
  toggleUnknown: (key: keyof EventForm, unknown: boolean) => void;
}

/** Wraps a field with the "not known yet" checkbox from the questionnaire. */
function Unknowable({
  name,
  label,
  children,
  unknown,
  toggleUnknown,
}: {
  name: keyof EventForm;
  label: string;
  children: ReactNode;
} & Pick<FieldProps, "unknown" | "toggleUnknown">) {
  const isUnknown = unknown.has(name);
  return (
    <Field label={label} htmlFor={name}>
      <div className={cn(isUnknown && "pointer-events-none opacity-40")}>{children}</div>
      <Checkbox
        className="text-muted"
        checked={isUnknown}
        onChange={(v) => toggleUnknown(name, v)}
        label={he.eventFields.unknownYet}
      />
    </Field>
  );
}

export function Chips<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:cursor-default",
            value === o
              ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
              : "border-line enabled:hover:bg-soft",
          )}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

const text = (v: string) => (v.trim() === "" ? null : v);

export function WhenFields({ form, set, unknown, toggleUnknown }: FieldProps) {
  const derived = unknown.has("eventTime") ? null : timeOfDayFor(form.eventTime);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Unknowable
        name="eventDate"
        label={he.eventFields.eventDate}
        unknown={unknown}
        toggleUnknown={toggleUnknown}
      >
        <Input
          id="eventDate"
          type="date"
          value={form.eventDate ?? ""}
          onChange={(e) => set("eventDate", text(e.target.value))}
        />
      </Unknowable>
      <Unknowable
        name="eventTime"
        label={he.eventFields.eventTime}
        unknown={unknown}
        toggleUnknown={toggleUnknown}
      >
        <Input
          id="eventTime"
          type="time"
          value={form.eventTime ?? ""}
          onChange={(e) => set("eventTime", text(e.target.value))}
        />
      </Unknowable>
      {derived ? (
        <p className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
          {derived === "noon" ? (
            <Sun className="size-4 text-gold" />
          ) : (
            <Moon className="size-4 text-brand-500" />
          )}
          <span>
            <span className="font-medium text-ink">
              {he.eventFields.derivedTimeOfDay(he.timeOfDay[derived])}
            </span>
            {he.eventFields.byStartTime}
          </span>
        </p>
      ) : (
        // Only asked while the start time is unknown.
        <Field label={he.eventFields.noonOrEvening} className="sm:col-span-2">
          <Chips
            options={TIMES_OF_DAY}
            labels={he.timeOfDay}
            value={form.timeOfDay}
            onChange={(v) => set("timeOfDay", v)}
          />
        </Field>
      )}
    </div>
  );
}

export function SizeFields({ form, set, unknown, toggleUnknown }: FieldProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Unknowable
        name="guestCount"
        label={he.eventFields.guestCount}
        unknown={unknown}
        toggleUnknown={toggleUnknown}
      >
        <Input
          id="guestCount"
          type="number"
          inputMode="numeric"
          dir="ltr"
          min={1}
          value={form.guestCount ?? ""}
          onChange={(e) =>
            set("guestCount", e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null)
          }
        />
      </Unknowable>
      <Unknowable
        name="estimatedBudgetAgorot"
        label={he.eventFields.budget}
        unknown={unknown}
        toggleUnknown={toggleUnknown}
      >
        <MoneyInput
          id="estimatedBudgetAgorot"
          value={form.estimatedBudgetAgorot}
          onChange={(v) => set("estimatedBudgetAgorot", v)}
        />
      </Unknowable>
    </div>
  );
}

export function PlaceFields({ form, set, unknown, toggleUnknown }: FieldProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Unknowable name="city" label={he.eventFields.city} unknown={unknown} toggleUnknown={toggleUnknown}>
        <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", text(e.target.value))} />
      </Unknowable>
      <Unknowable
        name="venueName"
        label={he.eventFields.venueName}
        unknown={unknown}
        toggleUnknown={toggleUnknown}
      >
        <Input
          id="venueName"
          value={form.venueName ?? ""}
          onChange={(e) => set("venueName", text(e.target.value))}
        />
      </Unknowable>
      <Field label={he.eventFields.venueAddress} htmlFor="venueAddress" className="sm:col-span-2">
        <Input
          id="venueAddress"
          value={form.venueAddress ?? ""}
          onChange={(e) => set("venueAddress", text(e.target.value))}
        />
      </Field>
    </div>
  );
}

export function PeopleFields({ form, set }: FieldProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={he.eventFields.partner1} htmlFor="partner1Name">
        <Input
          id="partner1Name"
          value={form.partner1Name ?? ""}
          onChange={(e) => set("partner1Name", text(e.target.value))}
        />
      </Field>
      <Field label={he.eventFields.partner2} htmlFor="partner2Name">
        <Input
          id="partner2Name"
          value={form.partner2Name ?? ""}
          onChange={(e) => set("partner2Name", text(e.target.value))}
        />
      </Field>
      <Field
        label={he.eventFields.eventName}
        htmlFor="name"
        className="sm:col-span-2"
        hint={he.eventFields.eventNameHint}
      >
        <Input
          id="name"
          value={form.name}
          placeholder={suggestName(form)}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
    </div>
  );
}

export function StyleFields({ form, set }: FieldProps) {
  return (
    <div className="flex flex-col gap-6">
      <Field label={he.eventFields.style}>
        <Chips
          options={EVENT_STYLES}
          labels={he.eventStyle}
          value={form.eventStyle}
          onChange={(v) => set("eventStyle", v)}
        />
      </Field>
      <Field label={he.eventFields.kashrut}>
        <Chips
          options={KASHRUT_LEVELS}
          labels={he.kashrut}
          value={form.kashrut}
          onChange={(v) => set("kashrut", v)}
        />
      </Field>
      <Field label={he.eventFields.ceremony}>
        <Chips
          options={CEREMONY_TYPES}
          labels={he.ceremonyType}
          value={form.ceremonyType}
          onChange={(v) => set("ceremonyType", v)}
        />
      </Field>
    </div>
  );
}

export function suggestName(form: Pick<EventForm, "partner1Name" | "partner2Name">): string {
  return he.eventFields.defaultName([form.partner1Name, form.partner2Name].filter((n): n is string => !!n));
}

/** Applies "not known yet" (→ null) and the default name before sending. */
export function toEventPayload(form: EventForm, unknown: Set<keyof EventForm>): EventForm {
  const out = { ...form, name: form.name.trim() || suggestName(form) };
  for (const key of unknown) if (key !== "name") (out as Record<string, unknown>)[key] = null;
  return out;
}
