import type {
  CeremonyType,
  ContractStatus,
  EventStyle,
  Kashrut,
  PaymentMethod,
  PricingType,
  Role,
  ScheduleStatus,
  TimeOfDay,
  UserType,
  VatMode,
} from "@sagarnu/domain";

/** Hebrew labels for every enum and server error code. */
export const he = {
  userType: { couple: "זוג", planner: "מפיק/ת אירועים" } satisfies Record<UserType, string>,
  role: { owner: "בעלים", editor: "עורך/ת", viewer: "צפייה בלבד" } satisfies Record<Role, string>,
  eventStyle: {
    hall: "אולם",
    garden: "גן אירועים",
    outdoor: "שטח",
    home: "בית",
    festival: "פסטיבל (לינה)",
    restaurant: "מסעדה",
    other: "אחר",
  } satisfies Record<EventStyle, string>,
  ceremonyType: {
    religious: "דתית (רבנות)",
    civil: "אזרחית",
    alternative: "אלטרנטיבית",
    other: "אחר",
  } satisfies Record<CeremonyType, string>,
  kashrut: { none: "ללא", kosher: "כשר", mehadrin: "מהדרין" } satisfies Record<Kashrut, string>,
  timeOfDay: { noon: "צהריים", evening: "ערב" } satisfies Record<TimeOfDay, string>,
  contractStatus: {
    quote: "הצעה התקבלה",
    negotiating: "במשא ומתן",
    approved: "מאושר",
    rejected: "לא מאושר",
    cancelled: "בוטל",
  } satisfies Record<ContractStatus, string>,
  vatMode: { included: "כולל מע״מ", excluded: "לא כולל מע״מ", unknown: "לא ידוע" } satisfies Record<
    VatMode,
    string
  >,
  pricingType: { fixed: "מחיר קבוע", per_guest: "לפי מנה", estimate: "הערכה" } satisfies Record<
    PricingType,
    string
  >,
  scheduleStatus: { pending: "ממתין", paid: "שולם", cancelled: "בוטל" } satisfies Record<
    ScheduleStatus,
    string
  >,
  paymentMethod: {
    credit_card: "כרטיס אשראי",
    cash: "מזומן",
    bank_transfer: "העברה בנקאית",
    check: "צ׳ק",
    bit: "ביט",
    paybox: "פייבוקס",
    other: "אחר",
  } satisfies Record<PaymentMethod, string>,
  errors: {
    bad_request: "הבקשה לא תקינה",
    validation_failed: "יש שדות שצריך לתקן",
    unauthorized: "צריך להתחבר מחדש",
    email_not_verified: "צריך לאמת את כתובת האימייל קודם",
    forbidden: "אין לך הרשאה לפעולה הזו",
    not_found: "לא נמצא",
    conflict: "הפעולה מתנגשת עם נתונים קיימים",
    version_conflict: "מישהו אחר עדכן את הפריט בינתיים. רעננו ונסו שוב",
    couple_event_limit: "לזוג יכול להיות אירוע אחד בבעלותו",
    confirmation_required: "הפעולה דורשת אישור",
    rate_limited: "יותר מדי ניסיונות. נסו שוב בעוד דקה",
    internal: "משהו השתבש. נסו שוב",
    network: "אין חיבור לשרת",
  },
  fieldErrors: {
    password_length: "לפחות 8 תווים",
    password_uppercase: "אות גדולה באנגלית (A-Z)",
    password_digit: "ספרה",
    password_special: "תו מיוחד (!@#$...)",
    password_mismatch: "הסיסמאות לא זהות",
    invalid_date: "תאריך לא תקין",
    invalid_time: "שעה לא תקינה",
    invalid_phone: "מספר טלפון לא תקין",
    must_be_positive: "הסכום חייב להיות גדול מ-0",
    required: "שדה חובה",
    invalid_image: "קובץ התמונה לא נתמך",
    invalid_url: "קישור לא תקין",
  },
} as const;

export type ErrorKey = keyof typeof he.errors;

export function errorMessage(code: string | undefined): string {
  return (code && code in he.errors ? he.errors[code as ErrorKey] : undefined) ?? he.errors.internal;
}

export function fieldErrorMessage(code: string | undefined): string {
  if (code && code in he.fieldErrors) return he.fieldErrors[code as keyof typeof he.fieldErrors];
  return "ערך לא תקין";
}
