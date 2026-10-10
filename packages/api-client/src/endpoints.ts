import type { ContractStatus } from "@sagarnu/domain";
import type {
  CategoryDto,
  ContractDetailDto,
  ContractDto,
  CreateContractInput,
  CreateEventInput,
  CustomCategoryInput,
  DashboardDto,
  EventDto,
  ExpensesDto,
  MeDto,
  MemberDto,
  PaymentInput,
  PaymentResultDto,
  ScheduleItemInput,
  UpdateContractInput,
  UpdateEventInput,
  UpdateMeInput,
} from "@sagarnu/schemas";
import { api } from "./client";

const ev = (eventId: string) => `/v1/events/${eventId}`;

export const endpoints = {
  me: {
    get: () => api<MeDto>("/v1/me"),
    update: (body: UpdateMeInput) => api<MeDto>("/v1/me", { method: "PATCH", body }),
  },
  events: {
    list: () => api<EventDto[]>("/v1/events"),
    create: (body: CreateEventInput) => api<EventDto>("/v1/events", { method: "POST", body }),
    get: (eventId: string) => api<EventDto>(ev(eventId)),
    update: (eventId: string, body: UpdateEventInput) =>
      api<EventDto>(ev(eventId), { method: "PATCH", body }),
    remove: (eventId: string) => api<void>(ev(eventId), { method: "DELETE" }),
    dashboard: (eventId: string) => api<DashboardDto>(`${ev(eventId)}/dashboard`),
    setCover: (eventId: string, dataUrl: string) =>
      api<EventDto>(`${ev(eventId)}/cover`, { method: "PUT", body: { dataUrl } }),
    removeCover: (eventId: string) => api<EventDto>(`${ev(eventId)}/cover`, { method: "DELETE" }),
    members: (eventId: string) => api<MemberDto[]>(`${ev(eventId)}/members`),
  },
  categories: {
    list: (eventId: string) => api<CategoryDto[]>(`${ev(eventId)}/categories`),
    create: (eventId: string, body: CustomCategoryInput) =>
      api<CategoryDto>(`${ev(eventId)}/categories`, { method: "POST", body }),
    remove: (eventId: string, categoryId: string) =>
      api<void>(`${ev(eventId)}/categories/${categoryId}`, { method: "DELETE" }),
    setRelevance: (eventId: string, categoryId: string, isRelevant: boolean) =>
      api<CategoryDto>(`${ev(eventId)}/categories/${categoryId}/relevance`, {
        method: "PUT",
        body: { isRelevant },
      }),
  },
  contracts: {
    list: (eventId: string) => api<ContractDto[]>(`${ev(eventId)}/contracts`),
    get: (eventId: string, contractId: string) =>
      api<ContractDetailDto>(`${ev(eventId)}/contracts/${contractId}`),
    create: (eventId: string, body: CreateContractInput) =>
      api<ContractDetailDto>(`${ev(eventId)}/contracts`, { method: "POST", body }),
    update: (eventId: string, contractId: string, body: UpdateContractInput) =>
      api<ContractDetailDto>(`${ev(eventId)}/contracts/${contractId}`, { method: "PATCH", body }),
    setStatus: (eventId: string, contractId: string, status: ContractStatus, confirm?: boolean) =>
      api<ContractDetailDto>(`${ev(eventId)}/contracts/${contractId}/status`, {
        method: "POST",
        body: { status, confirm },
      }),
    remove: (eventId: string, contractId: string, confirm?: boolean) =>
      api<void>(`${ev(eventId)}/contracts/${contractId}${confirm ? "?confirm=true" : ""}`, {
        method: "DELETE",
      }),
  },
  schedule: {
    add: (eventId: string, contractId: string, body: ScheduleItemInput) =>
      api<ContractDetailDto>(`${ev(eventId)}/contracts/${contractId}/schedule`, { method: "POST", body }),
    update: (
      eventId: string,
      itemId: string,
      body: Partial<ScheduleItemInput> & { status?: "pending" | "cancelled" },
    ) => api<ContractDetailDto>(`${ev(eventId)}/schedule/${itemId}`, { method: "PATCH", body }),
    remove: (eventId: string, itemId: string) =>
      api<void>(`${ev(eventId)}/schedule/${itemId}`, { method: "DELETE" }),
  },
  payments: {
    create: (eventId: string, contractId: string, body: PaymentInput) =>
      api<PaymentResultDto>(`${ev(eventId)}/contracts/${contractId}/payments`, { method: "POST", body }),
    update: (eventId: string, paymentId: string, body: Partial<PaymentInput>) =>
      api<PaymentResultDto>(`${ev(eventId)}/payments/${paymentId}`, { method: "PATCH", body }),
    remove: (eventId: string, paymentId: string) =>
      api<void>(`${ev(eventId)}/payments/${paymentId}`, { method: "DELETE" }),
  },
  expenses: {
    get: (eventId: string) => api<ExpensesDto>(`${ev(eventId)}/expenses`),
  },
};
