import type { ContractStatus, Role } from "@sagarnu/domain";
import type {
  AcceptInvitationResultDto,
  CategoryDto,
  ContractDetailDto,
  ContractDto,
  ContractFileDto,
  ContractFileUploadInput,
  CreateContractInput,
  CreateEventInput,
  CreateInvitationInput,
  CreateInvitationResultDto,
  CustomCategoryInput,
  DeleteAccountInput,
  DashboardDto,
  EventDto,
  ExpensesDto,
  InvitationDto,
  InvitationInfoDto,
  MeDto,
  MemberDto,
  PaymentFileDto,
  PaymentFileUploadInput,
  PaymentInput,
  PaymentResultDto,
  ScheduleItemInput,
  SessionDto,
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
    /** Same-origin download link (the browser sends the session cookie). */
    exportUrl: "/v1/me/export",
    remove: (body: DeleteAccountInput) => api<void>("/v1/me", { method: "DELETE", body }),
    sessions: () => api<SessionDto[]>("/v1/me/sessions"),
    revokeSession: (sessionId: string) => api<void>(`/v1/me/sessions/${sessionId}`, { method: "DELETE" }),
    revokeOtherSessions: () => api<{ removed: number }>("/v1/me/sessions", { method: "DELETE" }),
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
  members: {
    updateRole: (eventId: string, userId: string, role: Role) =>
      api<{ userId: string; role: Role }>(`${ev(eventId)}/members/${userId}`, {
        method: "PATCH",
        body: { role },
      }),
    remove: (eventId: string, userId: string) =>
      api<void>(`${ev(eventId)}/members/${userId}`, { method: "DELETE" }),
  },
  invitations: {
    list: (eventId: string) => api<InvitationDto[]>(`${ev(eventId)}/invitations`),
    create: (eventId: string, body: CreateInvitationInput) =>
      api<CreateInvitationResultDto>(`${ev(eventId)}/invitations`, { method: "POST", body }),
    revoke: (eventId: string, invitationId: string) =>
      api<void>(`${ev(eventId)}/invitations/${invitationId}`, { method: "DELETE" }),
    info: (token: string) => api<InvitationInfoDto>(`/v1/invitations/${encodeURIComponent(token)}`),
    accept: (token: string) =>
      api<AcceptInvitationResultDto>(`/v1/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      }),
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
    uploadFile: (eventId: string, paymentId: string, body: PaymentFileUploadInput) =>
      api<PaymentFileDto>(`${ev(eventId)}/payments/${paymentId}/files`, { method: "POST", body }),
    removeFile: (eventId: string, fileId: string) =>
      api<void>(`${ev(eventId)}/files/${fileId}`, { method: "DELETE" }),
  },
  contractFiles: {
    upload: (eventId: string, contractId: string, body: ContractFileUploadInput) =>
      api<ContractFileDto>(`${ev(eventId)}/contracts/${contractId}/files`, { method: "POST", body }),
    remove: (eventId: string, fileId: string) =>
      api<void>(`${ev(eventId)}/contract-files/${fileId}`, { method: "DELETE" }),
  },
  expenses: {
    get: (eventId: string) => api<ExpensesDto>(`${ev(eventId)}/expenses`),
    /** Excel download (an attachment, so the page stays). `payer` is a payerKey filter. */
    exportUrl: (eventId: string, payer?: string | null) =>
      `${ev(eventId)}/expenses/export${payer ? `?payer=${encodeURIComponent(payer)}` : ""}`,
  },
};
