import { type Db, schema, type Tx } from "@sagarnu/db";

export interface AuditEntry {
  eventId: string;
  actorId: string;
  entity: "event" | "contract" | "schedule_item" | "payment" | "category";
  entityId: string;
  action: "create" | "update" | "delete" | "status";
  diff?: Record<string, unknown>;
}

/** "Who changed the amount?" — every financial change in a shared event is recorded. */
export async function audit(db: Db | Tx, entry: AuditEntry): Promise<void> {
  await db.insert(schema.auditLog).values(entry);
}

/** Only the fields that actually changed, as `{field: [before, after]}`. */
export function diffOf<T extends Record<string, unknown>>(
  before: T,
  patch: Partial<T>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && JSON.stringify(before[key]) !== JSON.stringify(value)) {
      diff[key] = [before[key], value];
    }
  }
  return diff;
}
