# Contract extraction — ground-truth dataset

Manually labeled pairs of a **real vendor contract** and the **exact data the LLM should extract from it**:

```text
datasets/contracts/examples/
  contract_001.pdf    ← the document (never committed)
  contract_001.json   ← what a perfect extraction returns (never committed)
```

Used later for few-shot prompting, extraction evaluation (`pnpm eval:contracts`, planned in `docs/PLAN.txt` §Verification) and possibly fine-tuning.

> **Privacy.** Everything in `examples/` is git-ignored (except `.gitkeep`), and so is any `*.pdf` under `datasets/`. Real contracts contain names, phone numbers, ID numbers and prices — keep them local or in private storage. Only this README, the template, the gap notes and the validator are tracked.

## What the JSON is — and why

There is **no LLM extraction pipeline in the code yet** (phase 2). The only contract schema that is actually implemented is the payload the app accepts when a contract is saved — `createContractSchema` in [`packages/schemas/src/contracts.ts`](../../packages/schemas/src/contracts.ts). The planned pipeline ends in exactly that payload: the model's output is normalized and pre-fills the same contract form the user saves.

So a label is **that payload, in the app's canonical units** (agorot, ISO dates), restricted to what a document can contain. The validator derives its schema from `createContractSchema` directly — nothing is redefined:

```ts
createContractSchema.omit({ categoryId, status, contractUrl, notes }); // + schedule[].source excluded
```

This keeps the labels valid whatever the model's raw output format turns out to be; the planned `ContractExtraction` format (snake_case, shekels) can be mapped to it mechanically — see [SCHEMA_GAPS.md](SCHEMA_GAPS.md).

### Field classification (contract flow)

| Kind                                           | Fields                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Extracted from the document** (the label) | `vendorName`, `vendorBusinessId`, `vendorContactName`, `vendorPhone`, `vendorEmail`, `websiteUrl`, `facebookUrl`, `instagramUrl`, `totalAmountAgorot`, `vatMode`, `pricingType`, `perGuestPriceAgorot`, `minGuests`, `includedItems`, `excludedItems`, `cancellationPolicy`, `signedOn`, `schedule[]` (`label`, `amountAgorot`, `percent`, `dueDate`, `relativeAnchor`, `relativeDays`)                                      |
| **2. Derived by the app** (never labeled)      | `paidAgorot`, `remainingAgorot`, `overpaidAgorot`; a schedule item's resolved `dueDate` (from `relativeAnchor` + `relativeDays` + event date / `signedOn`) and resolved amount (from `percent` × total); `remainingAgorot` per item; schedule item `status` (pending → paid when covered by payments); per-guest suggested total (`price × max(guests, minGuests)`); `approvedAt`; overdue / next-due flags; expense summary |
| **3. Internal / database** (never labeled)     | `id`, `eventId`, `contractId`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `source` (contract and schedule item), `sortOrder`, audit log                                                                                                                                                                                                                                                     |
| **4. Entered by the user** (not in the label)  | `categoryId` (picked tab), `status` (quote / negotiating / approved …), `contractUrl` (where _they_ keep the file), `notes`; all **payments** (`amountAgorot`, `method`, `paidOn`, `receiptUrl`, `confirmationUrl`, `notes`, `scheduleItemId`) — they record money actually paid, not contract terms                                                                                                                         |

## How to label a contract

1. **Copy** the PDF to `examples/contract_NNN.pdf` (next free 3-digit number). Do not rename vendors in the file; the folder is private.
2. **Copy** [`contract_template.json`](contract_template.json) to `examples/contract_NNN.json` (same number).
3. **Read the whole document first**, including small print, appendices and handwritten additions.
4. **Fill every field** using the table and rules below. Leave a field as `null` / `[]` when the document does not state it. **Never fill from outside knowledge** (Google, the event details, what the vendor "usually" charges).
5. **Validate**: `pnpm dataset:validate` (all files) or `pnpm dataset:validate datasets/contracts/examples/contract_NNN.json`. Fix every _error_; read every _warning_ — a warning is fine if the contract itself really says so.
6. Optional: keep labeling notes (ambiguities, why you chose a value) in `examples/contract_NNN.notes.md` — not in the JSON, which must contain only schema fields.

Keep every key, in the template's order. Missing keys and unknown keys are errors: a typo like `totalAmount` would otherwise be silently dropped.

## Fields

“Required” means the key must have a non-null value. **Every key must always be present**; optional ones hold `null` (or `[]`).

| Field                 | Type                                        | Required     | Description                                                                                                                     | Example                                               | Usually found                                              | Missing / ambiguous / conflicting                                                                                                                               |
| --------------------- | ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vendorName`          | string, 1–120 chars                         | **yes**      | The vendor as the couple knows it — the trade/brand name. If only a legal entity appears, use it.                               | `"גני הוורדים"`                                       | Letterhead, logo, header, "בין … לבין", signature block    | Brand and legal name differ → brand name here (legal entity's ID goes to `vendorBusinessId`). Never invent: if truly absent, use what the signature block says. |
| `vendorBusinessId`    | string ≤ 20 \| null                         | no           | ח.פ. / ע.מ. / ע.פ. number, digits only as printed.                                                                              | `"514123456"`                                         | Header, footer, signature block, invoice details           | Absent → `null`. Two numbers (company + licensed dealer) → the one next to the contracting party's name.                                                        |
| `vendorContactName`   | string ≤ 120 \| null                        | no           | The person at the vendor who handles the event.                                                                                 | `"דנה כהן"`                                           | "איש קשר", signature, header                               | Several → the one named as contact; else the signer. None → `null`.                                                                                             |
| `vendorPhone`         | string ≤ 30 \| null                         | no           | Phone as printed, Israeli format with dashes.                                                                                   | `"050-1234567"`                                       | Header, footer, contact line                               | Several → mobile of the contact person; else the main number. Keep `+972` only if printed that way.                                                             |
| `vendorEmail`         | email \| null                               | no           | Vendor email, lowercase.                                                                                                        | `"info@example.co.il"`                                | Header, footer                                             | Must be a valid address; unreadable → `null`.                                                                                                                   |
| `websiteUrl`          | http(s) URL \| null                         | no           | Vendor website. Always with `https://` (add it if printed as `www.…`).                                                          | `"https://example.co.il"`                             | Footer, header                                             | No domain or broken → `null`. Social links go to the next two fields, not here.                                                                                 |
| `facebookUrl`         | http(s) URL \| null                         | no           | Facebook page.                                                                                                                  | `"https://facebook.com/example"`                      | Footer, icons                                              | Only "חפשו אותנו בפייסבוק" without a link → `null`.                                                                                                             |
| `instagramUrl`        | http(s) URL \| null                         | no           | Instagram profile. A bare handle `@example` → `"https://instagram.com/example"`.                                                | `"https://instagram.com/example"`                     | Footer, icons                                              | No handle/link → `null`.                                                                                                                                        |
| `totalAmountAgorot`   | integer ≥ 0 (agorot) \| null                | no           | The total price of the contract, **as stated**, in agorot.                                                                      | `12 500 ₪` → `1250000`                                | Price table, "סה״כ לתשלום", "התמורה", summary              | Not stated (e.g. per-guest pricing) → `null` — do **not** compute it. Several totals (before/after discount, before/after VAT) → see _Amounts & VAT_.           |
| `vatMode`             | `"included"` \| `"excluded"` \| `"unknown"` | **yes**      | Whether `totalAmountAgorot` (and the other amounts) include VAT.                                                                | `"excluded"`                                          | Next to the price: "כולל מע״מ", "+ מע״מ", "לא כולל מע״מ"   | Not mentioned → `"unknown"`. Contradictory statements → `"unknown"` and a note.                                                                                 |
| `pricingType`         | `"fixed"` \| `"per_guest"` \| `"estimate"`  | **yes**      | `fixed` — one price; `per_guest` — price per plate/guest; `estimate` — price explicitly not final ("הערכה", "החל מ־", "משוער"). | `"per_guest"`                                         | Price section                                              | Mixed (per-guest food + fixed extras) → `per_guest` when the main price is per guest.                                                                           |
| `perGuestPriceAgorot` | integer ≥ 0 (agorot) \| null                | no           | Price per guest/plate. Only with `pricingType: "per_guest"`.                                                                    | `250 ₪ למנה` → `25000`                                | Price table ("למנה", "לאורח", "לסועד")                     | Several tiers (adult/child) → adult price; mention the rest in notes.                                                                                           |
| `minGuests`           | integer 0–5000 \| null                      | no           | Minimum number of guests/plates charged.                                                                                        | `250`                                                 | "מינימום", "התחייבות ל־"                                   | Not stated → `null`.                                                                                                                                            |
| `includedItems`       | string[] (≤ 50, each 1–200 chars)           | — (use `[]`) | What the price includes — one short Hebrew phrase per item, as worded in the contract.                                          | `["הגברה ותאורה", "שעתיים צילום מגנטים"]`             | "המחיר כולל", "החבילה כוללת", bullet lists                 | No list → `[]`. Keep the contract's order; drop bullets/numbering.                                                                                              |
| `excludedItems`       | string[] (≤ 50, each 1–200 chars)           | — (use `[]`) | What is explicitly **not** included or costs extra.                                                                             | `["שעות נוספות", "דמי משלוח"]`                        | "המחיר אינו כולל", "בתוספת תשלום"                          | Only explicit exclusions; don't infer from what is missing.                                                                                                     |
| `cancellationPolicy`  | string ≤ 5000 \| null                       | no           | The cancellation / postponement terms, copied faithfully (whitespace normalized).                                               | `"ביטול עד 90 יום לפני האירוע – החזר מלא של המקדמה…"` | "ביטול", "דחייה", "פיצוי מוסכם", "דמי ביטול"               | No clause → `null`. Several clauses → join in document order, one per line (`\n`).                                                                              |
| `signedOn`            | `"YYYY-MM-DD"` \| null                      | no           | Date the contract was signed (or dated, if it is a signed document).                                                            | `"2026-05-01"`                                        | Top ("נערך ונחתם ביום"), signature block, handwritten date | Unsigned quote → `null`. Only a Hebrew-calendar date → `null` + note.                                                                                           |
| `schedule`            | array (≤ 24) of _schedule items_            | — (use `[]`) | The payment installments, one item per installment, **in document order**.                                                      | see below                                             | "תנאי תשלום", "פריסת תשלומים", "אופן התשלום"               | No schedule → `[]`.                                                                                                                                             |

### Schedule item

```json
{
  "label": "מקדמה",
  "amountAgorot": 500000,
  "percent": null,
  "dueDate": "2026-05-01",
  "relativeAnchor": null,
  "relativeDays": null
}
```

| Field            | Type                             | Required       | Description                                                                                                             | Example                            | Missing / ambiguous                                                                                                                               |
| ---------------- | -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`          | string 1–120                     | **yes**        | The installment's name as in the contract; if unnamed, a short Hebrew name.                                             | `"מקדמה"`, `"תשלום שני"`, `"יתרה"` | Unnamed → `"תשלום 1"`, `"תשלום 2"`…                                                                                                               |
| `amountAgorot`   | integer > 0 (agorot) \| null     | no             | The installment amount **if stated as an amount**.                                                                      | `5 000 ₪` → `500000`               | Stated as a percentage only → `null` (use `percent`). Stated as both → the amount here, `percent: null`. "The balance" without a number → `null`. |
| `percent`        | number 0–100 \| null             | no             | The installment as a percentage of the total, **only if no amount is stated**.                                          | `30% מקדמה` → `30`                 | —                                                                                                                                                 |
| `dueDate`        | `"YYYY-MM-DD"` \| null           | no             | A fixed calendar due date.                                                                                              | `"2026-09-15"`                     | Relative timing → `null` and use the two fields below. No timing → `null`.                                                                        |
| `relativeAnchor` | `"signing"` \| `"event"` \| null | no             | What a relative due date counts from.                                                                                   | `"event"`                          | Fixed date or none → `null`.                                                                                                                      |
| `relativeDays`   | integer −3650…3650 \| null       | with an anchor | Days from the anchor: **negative = before**, positive = after, `0` = on the day. Required when `relativeAnchor` is set. | `"שבוע לפני האירוע"` → `-7`        | See _Payment schedules_.                                                                                                                          |

## Labeling rules

### Dates

- Output ISO `YYYY-MM-DD`. Israeli documents are **day/month/year**: `01/05/26` → `2026-05-01` (never May → January).
- Two-digit years are 20xx. A date without a year → `null` unless the year is unambiguous from the same document.
- Hebrew-calendar dates only (`ט״ו באב תשפ״ז`) → `null`; don't convert.
- Handwritten dates count if legible.

### Currency and amounts

- All money is **integer agorot**: `₪12,500` → `1250000`; `12.5 אלף` → `1250000`; `₪1,234.50` → `123450`; written in words (`שנים עשר אלף`) → `1200000`.
- Only ILS is supported. A price in another currency → leave the amount `null` and note it.
- Label what the contract **states**; never compute a total, a VAT amount, or an installment the document does not give.
- A discount stated with a final price → use the final price. A discount without a final price → the pre-discount price and a note.

### VAT (מע״מ)

- `vatMode` describes the amounts **as written**. `10,000 ₪ + מע״מ` → `totalAmountAgorot: 1000000`, `vatMode: "excluded"` (do not add 18%).
- `כולל מע״מ` → `"included"`. Silent → `"unknown"`. A vendor that is עוסק פטור and says so → `"included"` (no VAT will be added).
- If both totals are printed (before and after VAT), use the **after-VAT** total with `"included"`.
- One `vatMode` covers the whole contract; if installments and total disagree, follow the total.

### Payment schedules

- One item per installment, in document order; don't merge or split.
- Relative timing:
  | Contract says             | `relativeAnchor` | `relativeDays` |
  | ------------------------- | ---------------- | -------------- |
  | במעמד החתימה / עם החתימה  | `signing`        | `0`            |
  | 30 יום מהחתימה            | `signing`        | `30`           |
  | שבוע לפני האירוע          | `event`          | `-7`           |
  | שבועיים לפני              | `event`          | `-14`          |
  | חודש לפני האירוע          | `event`          | `-30`          |
  | ביום האירוע / בתום האירוע | `event`          | `0`            |
  | יום אחרי האירוע           | `event`          | `1`            |
- "Month" = 30 days, "week" = 7. "Up to / no later than X" → X itself.
- A fixed date and a relative one for the same installment → the fixed date, `relativeAnchor: null`.
- Percentages: `percent` only when no amount is printed. `30% (15,000 ₪)` → `amountAgorot: 1500000`, `percent: null`.
- Installments that don't add up to the total → keep what the contract says; the validator will warn, which is expected.

### Cancellation terms

- Copy the clause text faithfully, including every number, deadline and fee. Normalize whitespace; don't summarize or translate.
- Postponement (דחיית מועד) and force-majeure terms that affect money belong here too.

### Hebrew text

- Keep Hebrew as written; don't translate, transliterate or "fix" spelling of names.
- Remove invisible direction marks (RLM/LRM/zero-width) — the validator warns about them; normalize repeated spaces.
- Keep geresh/gershayim as printed (`מע״מ`, `מע"מ` are both fine).
- No bullets, numbering, or trailing punctuation in `includedItems` / `excludedItems` / `label`.

### Missing, ambiguous, conflicting

- **Missing** → `null` (scalars) or `[]` (lists). Never guess.
- **Ambiguous** (e.g. illegible digits, unclear which of two prices) → `null`, and explain in `contract_NNN.notes.md`.
- **Conflicting** (two different totals) → the value in the binding part (signed price table / summary over marketing text); later clause over earlier when they amend it; note the conflict.

## Validation

```sh
pnpm dataset:validate                                            # every examples/*.json
pnpm dataset:validate datasets/contracts/examples/contract_001.json
```

Checks, in order:

1. Valid JSON, object at the top level.
2. **Structure**: every key present, no unknown keys (including inside schedule items); `schedule[].source` is rejected as app-internal.
3. **The app's own schema** (`createContractSchema`, reused): types, agorot integers, ISO dates, enums, URL format, lengths, `relativeDays` required with an anchor.
4. **Consistency warnings**: installments vs total (using the app's `resolveScheduleAmount`), percentages > 100%, per-guest fields vs `pricingType`, amount + percent both set, fixed + relative date both set, signing-relative items without `signedOn`, due dates before signing, invisible direction marks.
5. A matching `.pdf` next to each example.

Errors exit with code 1; warnings don't. The validator's own tests (`pnpm --filter @sagarnu/datasets test`) run in CI and fail if the template drifts from the schema.

## Known gaps

The planned LLM output (`ContractExtraction`, `docs/PLAN.txt` §6) and the implemented schema/DB/UI differ in several places — category guess, confidence, warnings, raw text, event date, units and naming. They are listed in [SCHEMA_GAPS.md](SCHEMA_GAPS.md) rather than patched here.
