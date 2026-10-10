# Contract extraction — schema gaps

Found while preparing the ground-truth dataset (2026-10-10). Nothing here was changed in the app; these are inputs for phase 2.

## 1. No extraction pipeline exists yet

The phase-2 pipeline in `docs/PLAN.txt` §6 is design only. Not in the code:

- `packages/ai` (Groq client, prompts, `ContractExtraction` Zod schema, OCR).
- File upload (`POST /v1/events/:id/files`), R2 storage, `contract_file` and `contract_analysis` tables, `POST /v1/events/:id/analyses`.
- The worker (`apps/worker`, pg-boss `contract.analyze` job).
- The UI path: "העלאת קובץ" is shown as **בקרוב** in the new-contract chooser.

Consequence: the dataset targets the **implemented** contract schema (`createContractSchema`), which is what an extraction ultimately pre-fills. See the mapping in §3.

## 2. Planned `ContractExtraction` vs. implemented contract schema

| Topic                  | Planned LLM output (PLAN §6)                      | Implemented (`packages/schemas`, DB `contract`) | Notes                                                                                           |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Naming                 | snake_case, nested `vendor{}` / `pricing{}`       | camelCase, flat                                 | Mechanical mapping (§3).                                                                        |
| Money units            | ILS numbers (`12500`)                             | integer agorot (`1250000`)                      | Planned normalization step converts.                                                            |
| Category               | `category_guess` (system key)                     | `categoryId` (UUID), chosen by the user         | **No field to hold a guess.** Ground truth can't record the correct category.                   |
| Event date             | `event_date_in_contract`                          | none on `contract` (event has `eventDate`)      | Useful to detect a contract for the wrong date; no place to store it.                           |
| Signing date           | —                                                 | `signedOn` (anchor for "N days after signing")  | Planned schema lacks it, yet relative-to-signing installments need it. Dataset includes it.     |
| Status / document kind | —                                                 | `status` (user's decision)                      | A document is a _quote_ vs a _signed contract_; neither schema captures that as extracted fact. |
| Raw text               | `pricing.raw_text`, `payment_schedule[].raw_text` | none                                            | Needed for review UI ("show source") and for Hebrew-calendar/ambiguous dates; not stored.       |
| Warnings               | `warnings[]` (Hebrew)                             | none (only free `notes`, user-owned)            | Unusual terms (overtime, price increases) have no structured home.                              |
| Confidence             | per top-level field                               | none                                            | Planned UI marks low-confidence fields; nothing stores it.                                      |
| Social links           | `vendor.website` only                             | `websiteUrl`, `facebookUrl`, `instagramUrl`     | Planned output can't fill Facebook/Instagram.                                                   |
| Contract link          | —                                                 | `contractUrl`                                   | User's own link; not extractable (correctly absent from the dataset).                           |
| Relative due date      | `relative: { anchor, days_offset }`               | `relativeAnchor`, `relativeDays`                | Same meaning, different shape.                                                                  |
| List limits            | `included_items` / `excluded_items` max 30        | max 50 items, 200 chars each                    | Pick one limit.                                                                                 |
| Schedule size          | —                                                 | max 24 items                                    | —                                                                                               |

## 3. Mapping ground truth ⇄ planned `ContractExtraction`

To compare a model output in the planned format with a label:

| Ground truth                                                                                      | Planned output                                                                                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `vendorName`, `vendorBusinessId`, `vendorContactName`, `vendorPhone`, `vendorEmail`, `websiteUrl` | `vendor.name`, `vendor.business_id`, `vendor.contact_name`, `vendor.phone`, `vendor.email`, `vendor.website` |
| `facebookUrl`, `instagramUrl`, `signedOn`                                                         | — (not produced)                                                                                             |
| `totalAmountAgorot`                                                                               | `pricing.total × 100`                                                                                        |
| `perGuestPriceAgorot`                                                                             | `pricing.per_guest_price × 100`                                                                              |
| `minGuests`, `vatMode`, `pricingType`                                                             | `pricing.min_guests`, `pricing.vat`, `pricing.pricing_type` (`null` → `"fixed"`)                             |
| `includedItems`, `excludedItems`, `cancellationPolicy`                                            | `included_items`, `excluded_items`, `cancellation_policy`                                                    |
| `schedule[i].label / percent / dueDate`                                                           | `payment_schedule[i].label / percent / due_date`                                                             |
| `schedule[i].amountAgorot`                                                                        | `payment_schedule[i].amount × 100`                                                                           |
| `schedule[i].relativeAnchor / relativeDays`                                                       | `payment_schedule[i].relative.anchor / .days_offset`                                                         |
| —                                                                                                 | `category_guess`, `event_date_in_contract`, `raw_text`, `warnings`, `confidence` (not in ground truth)       |

## 4. Schema vs. UI vs. API

- **`vendorBusinessId` has no input in the contract form.** It is in the schema, the DB, the form state and the API, but nothing on screen lets a user see or edit it.
- **"After the event" installments**: the schema allows `relativeAnchor: "event"` with positive `relativeDays`, but the form only offers "ימים לפני האירוע" and "ימים אחרי החתימה".
- **Schedule editing**: on an existing contract, the edit dialog has no schedule section (items are edited one by one in the vendor drawer) — fine for users, but an AI pre-fill of a _new_ contract is the only place a whole schedule is submitted at once.
- **Percent + amount**: both may be stored; the app silently uses the amount (`resolveScheduleAmount`). An extraction that fills both is not rejected.
- **Fixed + relative date**: both may be stored; the relative one wins (`resolveDueDate`).
- **VAT**: one `vatMode` per contract, no separate before/after-VAT amounts, and open question 7 in the plan (normalize everything to "including VAT"?) is unanswered. Installments can't carry their own VAT status.
- **Per-guest tiers** (adult/child plates, different menus) and **overtime / extra-hour prices**: no fields.
- **Currency**: ILS only.
