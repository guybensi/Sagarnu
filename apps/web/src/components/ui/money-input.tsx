"use client";

import { shekelsToAgorot } from "@sagarnu/domain";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./form";

const toText = (agorot: number | null) =>
  agorot == null ? "" : (agorot / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Edits shekels as text, reports agorot (integer) — no floats ever reach the API. */
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

  // Follow external changes (e.g. "use remaining amount") without fighting the user's typing.
  useEffect(() => {
    setText((current) => (shekelsToAgorot(current) === value ? current : toText(value)));
  }, [value]);

  return (
    <div className="relative w-full min-w-0">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() === "" ? null : shekelsToAgorot(e.target.value));
        }}
        onBlur={() => setText(toText(shekelsToAgorot(text)))}
        className={cn("ps-8 text-start")}
      />
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted">
        ₪
      </span>
    </div>
  );
}
