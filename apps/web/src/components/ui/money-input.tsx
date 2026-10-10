"use client";

import { shekelsToAgorot } from "@sagarnu/domain";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./form";

const toText = (agorot: number | null) =>
  agorot == null || Number.isNaN(agorot)
    ? ""
    : (agorot / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Edits shekels as text, reports agorot (integer) — no floats ever reach the API.
 * Empty → null. Text that is not a valid amount → NaN, so form validation flags it instead of the
 * value silently disappearing.
 */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0",
  disabled,
  invalid,
}: {
  value: number | null;
  onChange: (agorot: number | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [text, setText] = useState(toText(value));
  const badText = text.trim() !== "" && shekelsToAgorot(text) == null;

  // Follow external changes (e.g. "use remaining amount") without fighting the user's typing.
  useEffect(() => {
    setText((current) => {
      const parsed = current.trim() === "" ? null : (shekelsToAgorot(current) ?? Number.NaN);
      return Object.is(parsed, value) ? current : toText(value);
    });
  }, [value]);

  return (
    <div className="relative w-full min-w-0">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || badText || undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value;
          onChange(raw.trim() === "" ? null : (shekelsToAgorot(raw) ?? Number.NaN));
        }}
        // Reformat valid amounts ("12500" → "12,500"); leave invalid text for the user to fix.
        onBlur={() => {
          const parsed = shekelsToAgorot(text);
          if (parsed != null) setText(toText(parsed));
        }}
        className={cn("ps-8 text-start")}
      />
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted">
        ₪
      </span>
    </div>
  );
}
