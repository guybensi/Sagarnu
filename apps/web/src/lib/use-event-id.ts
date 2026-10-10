"use client";

import { useEvent } from "@sagarnu/api-client";
import { can, type EventAction } from "@sagarnu/domain";
import { useParams } from "next/navigation";

export function useEventId(): string {
  return useParams<{ eventId: string }>().eventId;
}

/** Hides edit controls the user's role cannot use (the API enforces it anyway). */
export function useCan(action: EventAction): boolean {
  const event = useEvent(useEventId());
  return can(event.data?.role, action);
}
