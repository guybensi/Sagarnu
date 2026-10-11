/**
 * Where to go after login / sign-up (`?next=/invite/…`). Only same-site paths are allowed, so the
 * parameter cannot be used to send people to another website.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export const withNext = (path: string, next: string | null) =>
  next ? `${path}?next=${encodeURIComponent(next)}` : path;
