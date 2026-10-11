import { USER_TYPES } from "@sagarnu/domain";
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const passwordRules = {
  length: (p: string) => p.length >= PASSWORD_MIN_LENGTH,
  uppercase: (p: string) => /[A-Z]/.test(p),
  digit: (p: string) => /\d/.test(p),
  special: (p: string) => /[^A-Za-z0-9]/.test(p),
} as const;
export type PasswordRule = keyof typeof passwordRules;

export function failedPasswordRules(password: string): PasswordRule[] {
  return (Object.keys(passwordRules) as PasswordRule[]).filter((rule) => !passwordRules[rule](password));
}

export const passwordSchema = z
  .string()
  .max(128)
  .superRefine((value, ctx) => {
    for (const rule of failedPasswordRules(value))
      ctx.addIssue({ code: "custom", message: `password_${rule}` });
  });

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: passwordSchema,
  userType: z.enum(USER_TYPES),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  rememberMe: z.boolean(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: z.email() });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "password_mismatch" });

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, { message: "invalid_phone" })
    .nullable()
    .optional(),
  defaultEventId: z.uuid().nullable().optional(),
  /** Consent to WhatsApp reminders (phase 3). Needs a phone number. */
  whatsappOptIn: z.boolean().optional(),
  userType: z.enum(USER_TYPES).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** Deleting the account: the password when there is one, and an explicit confirmation. */
export const deleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.literal(true),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
