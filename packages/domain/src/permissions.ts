import type { Role } from "./enums";

export type EventAction =
  | "event.view"
  | "event.edit"
  | "event.delete"
  | "contract.write"
  | "contract.delete"
  | "payment.write"
  | "members.manage";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

const MIN_ROLE: Record<EventAction, Role> = {
  "event.view": "viewer",
  "event.edit": "editor",
  "contract.write": "editor",
  "contract.delete": "editor",
  "payment.write": "editor",
  "event.delete": "owner",
  "members.manage": "owner",
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export function minRoleFor(action: EventAction): Role {
  return MIN_ROLE[action];
}

export function can(role: Role | null | undefined, action: EventAction): boolean {
  return role != null && roleAtLeast(role, MIN_ROLE[action]);
}
