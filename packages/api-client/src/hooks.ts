import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "./endpoints";

/** Every query of an event lives under `["event", eventId]`, so one invalidation refreshes the whole screen. */
export const keys = {
  me: ["me"] as const,
  events: ["events"] as const,
  event: (eventId: string) => ["event", eventId] as const,
  dashboard: (eventId: string) => ["event", eventId, "dashboard"] as const,
  categories: (eventId: string) => ["event", eventId, "categories"] as const,
  contracts: (eventId: string) => ["event", eventId, "contracts"] as const,
  contract: (eventId: string, contractId: string) => ["event", eventId, "contract", contractId] as const,
  expenses: (eventId: string) => ["event", eventId, "expenses"] as const,
  members: (eventId: string) => ["event", eventId, "members"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: endpoints.me.get });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: endpoints.events.list });

export const useEvent = (eventId: string) =>
  useQuery({ queryKey: [...keys.event(eventId), "info"], queryFn: () => endpoints.events.get(eventId) });

export const useDashboard = (eventId: string) =>
  useQuery({ queryKey: keys.dashboard(eventId), queryFn: () => endpoints.events.dashboard(eventId) });

export const useCategories = (eventId: string) =>
  useQuery({ queryKey: keys.categories(eventId), queryFn: () => endpoints.categories.list(eventId) });

export const useContracts = (eventId: string) =>
  useQuery({ queryKey: keys.contracts(eventId), queryFn: () => endpoints.contracts.list(eventId) });

export const useContract = (eventId: string, contractId: string | null) =>
  useQuery({
    queryKey: keys.contract(eventId, contractId ?? ""),
    queryFn: () => endpoints.contracts.get(eventId, contractId!),
    enabled: contractId != null,
  });

export const useExpenses = (eventId: string) =>
  useQuery({ queryKey: keys.expenses(eventId), queryFn: () => endpoints.expenses.get(eventId) });

export const useMembers = (eventId: string) =>
  useQuery({ queryKey: keys.members(eventId), queryFn: () => endpoints.events.members(eventId) });

/** A mutation that refreshes everything about the event when it succeeds. */
export function useEventMutation<TVars, TResult>(eventId: string, fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.event(eventId) }),
        qc.invalidateQueries({ queryKey: keys.events }),
      ]);
    },
  });
}
