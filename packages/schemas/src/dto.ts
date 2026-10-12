import type {
  CeremonyType,
  ContractStatus,
  EventStyle,
  ExpenseSummary,
  IsoDate,
  Kashrut,
  PartnerRole,
  Payer,
  PayerTotal,
  PaymentFileKind,
  PaymentMethod,
  PricingType,
  RelativeAnchor,
  Role,
  ScheduleSource,
  ScheduleStatus,
  TimeOfDay,
  UserType,
  VatMode,
} from "@sagarnu/domain";

/** Response shapes of the REST API. Timestamps are ISO strings, money is agorot. */

export interface MeDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  userType: UserType;
  phoneE164: string | null;
  /** ISO time of WhatsApp consent, null when not given. */
  whatsappOptInAt: string | null;
  defaultEventId: string | null;
  /** False for accounts that only sign in with Google. */
  hasPassword: boolean;
  /** A Google account is connected, so "continue with Google" signs in here. */
  hasGoogle: boolean;
}

/** A signed-in device. `lastActiveAt` is updated about once a day. */
export interface SessionDto {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface EventDto {
  id: string;
  name: string;
  eventDate: IsoDate | null;
  eventTime: string | null;
  guestCount: number | null;
  estimatedBudgetAgorot: number | null;
  city: string | null;
  venueName: string | null;
  venueAddress: string | null;
  partner1Name: string | null;
  partner2Name: string | null;
  partner1Role: PartnerRole | null;
  partner2Role: PartnerRole | null;
  defaultPayer: Payer | null;
  defaultPayerName: string | null;
  eventStyle: EventStyle | null;
  ceremonyType: CeremonyType | null;
  kashrut: Kashrut | null;
  timeOfDay: TimeOfDay | null;
  notes: string | null;
  questionnaireCompletedAt: string | null;
  /** Relative URL of the dashboard photo (cache-busted), or null. */
  coverPhotoUrl: string | null;
  role: Role;
}

export interface CategoryDto {
  id: string;
  key: string | null;
  nameHe: string;
  icon: string | null;
  sortOrder: number;
  isCustom: boolean;
  isRelevant: boolean;
}

export interface ScheduleItemDto {
  id: string;
  contractId: string;
  label: string;
  amountAgorot: number | null;
  percent: number | null;
  /** Resolved due date (relative items already computed). */
  dueDate: IsoDate | null;
  relativeAnchor: RelativeAnchor | null;
  relativeDays: number | null;
  status: ScheduleStatus;
  source: ScheduleSource;
  sortOrder: number;
  /** What is still owed on this item. */
  remainingAgorot: number | null;
}

export interface PaymentDto {
  id: string;
  contractId: string;
  scheduleItemId: string | null;
  amountAgorot: number;
  method: PaymentMethod;
  paidOn: IsoDate;
  payer: Payer | null;
  payerName: string | null;
  receiptUrl: string | null;
  confirmationUrl: string | null;
  notes: string | null;
  createdAt: string;
  files: PaymentFileDto[];
}

export interface PaymentFileDto {
  id: string;
  kind: PaymentFileKind;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Relative URL; only event members can open it. */
  url: string;
  createdAt: string;
}

export interface ContractDto {
  id: string;
  categoryId: string;
  status: ContractStatus;
  vendorName: string;
  vendorBusinessId: string | null;
  vendorContactName: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  contractUrl: string | null;
  totalAmountAgorot: number | null;
  vatMode: VatMode;
  pricingType: PricingType;
  perGuestPriceAgorot: number | null;
  minGuests: number | null;
  includedItems: string[];
  excludedItems: string[];
  cancellationPolicy: string | null;
  notes: string | null;
  signedOn: IsoDate | null;
  source: "manual" | "ai";
  version: number;
  createdAt: string;
  updatedAt: string;
  paidAgorot: number;
  remainingAgorot: number | null;
  overpaidAgorot: number;
}

export interface ContractDetailDto extends ContractDto {
  schedule: ScheduleItemDto[];
  payments: PaymentDto[];
}

export interface DueItemDto {
  scheduleItemId: string;
  contractId: string;
  vendorName: string;
  label: string;
  dueDate: IsoDate;
  remainingAgorot: number | null;
}

export interface DashboardDto {
  event: EventDto;
  summary: ExpenseSummary;
  overdue: DueItemDto[];
  upcoming: DueItemDto[];
  vendors: {
    approved: number;
    negotiating: number;
    quotes: number;
    /** Relevant categories that still have no approved contract. */
    missingCategories: Pick<CategoryDto, "id" | "nameHe" | "icon">[];
  };
}

export interface ExpenseRowDto {
  contract: ContractDto;
  categoryName: string;
  nextDue: DueItemDto | null;
  isOverdue: boolean;
  /** What each payer paid towards this contract. */
  paidBy: PayerTotal[];
}

export interface ExpensesDto {
  summary: ExpenseSummary;
  rows: ExpenseRowDto[];
  /** Everything paid in the event, per payer (including vendors no longer active). */
  paidBy: PayerTotal[];
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

export interface CreateInvitationResultDto {
  invitation: InvitationDto;
  /** Shown once: only a hash of the token is stored. */
  inviteUrl: string;
  /** False when the email could not be delivered (e.g. no verified sending domain yet). */
  emailSent: boolean;
}

/** Public preview of an invitation link (no login needed). */
export interface InvitationInfoDto {
  status: "valid" | "expired" | "accepted" | "revoked";
  eventName: string;
  eventDate: IsoDate | null;
  inviterName: string;
  role: Role;
}

export interface AcceptInvitationResultDto {
  eventId: string;
  role: Role;
}

/** Returned after a payment is saved so the client can show the "next payment" prompt. */
export interface PaymentResultDto {
  payment: PaymentDto;
  remainingAgorot: number | null;
  nextDue: DueItemDto | null;
}
