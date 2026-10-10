import { ApiRequestError } from "@sagarnu/api-client";
import { errorMessage, fieldErrorMessage } from "@sagarnu/i18n";
import type { ZodError } from "zod";
import { toast } from "sonner";

export function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) return errorMessage(error.code);
  return errorMessage("internal");
}

export function toastError(error: unknown): void {
  toast.error(messageOf(error));
}

/** `{ "vendorName": "שדה חובה" }` from a Zod error, for inline field messages. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = fieldErrorMessage(issue.message);
  }
  return out;
}

export function isConfirmationRequired(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.code === "confirmation_required";
}
