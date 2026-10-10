import type { ApiError } from "@sagarnu/schemas";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | { code: "network" },
  ) {
    super(body.code);
  }

  get code(): string {
    return this.body.code;
  }

  get details(): Record<string, unknown> | undefined {
    return "details" in this.body ? this.body.details : undefined;
  }

  get fields(): Record<string, string[]> | undefined {
    return "fields" in this.body ? this.body.fields : undefined;
  }
}

let baseUrl = "";

/**
 * Web uses relative URLs (same origin, proxied to the API). A native app sets the API origin here
 * and authenticates with a bearer token instead of cookies.
 */
export function configureApi(opts: { baseUrl: string }): void {
  baseUrl = opts.baseUrl;
}

export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, { code: "network" });
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({ code: "internal" }));
  if (!res.ok) throw new ApiRequestError(res.status, json as ApiError);
  return json as T;
}
