import type { ApiError, ErrorCode } from "@sagarnu/schemas";
import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  email_not_verified: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  version_conflict: 409,
  couple_event_limit: 409,
  confirmation_required: 409,
  rate_limited: 429,
  wrong_password: 403,
  sole_owner: 409,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export const notFound = () => new AppError("not_found");

/** Errors are `{code, message?, fields?, details?}` — the client translates `code`. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ code: "not_found" } satisfies ApiError);
  });

  app.setErrorHandler((error: FastifyError | AppError | ZodError, req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({ code: error.code, details: error.details } satisfies ApiError);
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of error.issues) (fields[issue.path.join(".") || "_"] ??= []).push(issue.message);
      return reply.status(422).send({ code: "validation_failed", fields } satisfies ApiError);
    }
    if (error.statusCode === 429) return reply.status(429).send({ code: "rate_limited" } satisfies ApiError);
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ code: "bad_request" } satisfies ApiError);
    }
    req.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({ code: "internal" } satisfies ApiError);
  });
}
