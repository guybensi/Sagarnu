import type { PartnerRole, Payer } from "@sagarnu/domain";
import { he } from "./he";

export interface Couple {
  partner1Name: string | null;
  partner2Name: string | null;
  partner1Role: PartnerRole | null;
  partner2Role: PartnerRole | null;
}

/** How the app refers to a partner: the name, else the chosen role ("החתן"), else a neutral label. */
export function partnerName(couple: Couple, which: 1 | 2): string {
  const name = (which === 1 ? couple.partner1Name : couple.partner2Name)?.trim();
  if (name) return name;
  const role = which === 1 ? couple.partner1Role : couple.partner2Role;
  if (!role) return he.eventFields.neutralPartner(which);
  return couple.partner1Role === couple.partner2Role
    ? `${he.partnerRole[role]} ${which}`
    : he.partnerRoleDefinite[role];
}

/** Labels for every payer option, using the couple's names ("החשבון של נועה"). */
export function payerLabels(couple: Couple): Record<Payer, string> {
  const p1 = partnerName(couple, 1);
  const p2 = partnerName(couple, 2);
  return {
    partner1: he.payer.account(p1),
    partner2: he.payer.account(p2),
    joint: he.payer.joint,
    partner1_parents: he.payer.parents(p1),
    partner2_parents: he.payer.parents(p2),
    other: he.payer.other,
  };
}

/** One payer as shown on a payment: the typed name for "other", "לא צוין" when not recorded. */
export function payerLabel(couple: Couple, payer: Payer | null, payerName: string | null): string {
  if (!payer) return he.payer.unknown;
  if (payer === "other") return payerName?.trim() || he.payer.other;
  return payerLabels(couple)[payer];
}
