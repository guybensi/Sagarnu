import type { ContractStatus, ScheduleStatus } from "@sagarnu/domain";
import type { Tone } from "@/components/ui/card";

export const contractTone: Record<ContractStatus, Tone> = {
  quote: "neutral",
  negotiating: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "danger",
};

export const scheduleTone: Record<ScheduleStatus, Tone> = {
  pending: "brand",
  paid: "success",
  cancelled: "neutral",
};
