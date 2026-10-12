"use client";

import { PAYERS, type Payer } from "@sagarnu/domain";
import { he, payerLabels, type Couple } from "@sagarnu/i18n";
import { Field, Input, Select } from "@/components/ui/form";

/** Who paid: the couple's accounts by name, parents, joint, or "other" with a typed name. */
export function PayerPicker({
  id,
  label,
  hint,
  couple,
  payer,
  payerName,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  couple: Couple;
  payer: Payer | null;
  payerName: string | null;
  onChange: (payer: Payer | null, payerName: string | null) => void;
}) {
  const labels = payerLabels(couple);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={label} htmlFor={id} hint={hint}>
        <Select
          id={id}
          value={payer ?? ""}
          onChange={(e) => onChange((e.target.value || null) as Payer | null, payerName)}
        >
          <option value="">{he.payer.unknown}</option>
          {PAYERS.map((p) => (
            <option key={p} value={p}>
              {labels[p]}
            </option>
          ))}
        </Select>
      </Field>
      {payer === "other" && (
        <Field label={he.eventFields.otherPayerName} htmlFor={`${id}Name`}>
          <Input
            id={`${id}Name`}
            maxLength={80}
            placeholder={he.eventFields.otherPayerPlaceholder}
            value={payerName ?? ""}
            onChange={(e) => onChange(payer, e.target.value || null)}
          />
        </Field>
      )}
    </div>
  );
}
