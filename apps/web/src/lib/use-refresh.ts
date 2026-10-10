"use client";

import { keys } from "@sagarnu/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** Refetches every query of the event (dashboard, contracts, expenses…) after a change. */
export function useRefreshEvent(eventId: string): () => Promise<void> {
  const qc = useQueryClient();
  return useCallback(async () => {
    await qc.invalidateQueries({ queryKey: keys.event(eventId) });
  }, [qc, eventId]);
}
