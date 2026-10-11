import type { Db } from "@sagarnu/db";
import type { UserType } from "@sagarnu/domain";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import type { Auth } from "../auth";
import type { Env } from "../env";
import { AppError } from "./errors";

export interface AppContext {
  env: Env;
  db: Db;
  auth: Auth;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  userType: UserType;
  phoneE164?: string | null;
  defaultEventId?: string | null;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
  interface FastifyRequest {
    user: SessionUser | null;
    /** The current session row (for "this device" in the sessions list). */
    sessionId: string | null;
  }
}

export async function requireUser(req: FastifyRequest): Promise<void> {
  const session = await req.server.ctx.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new AppError("unauthorized");
  req.user = session.user as SessionUser;
  req.sessionId = session.session.id;
}

/** For handlers behind `requireUser`. */
export function currentUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new AppError("unauthorized");
  return req.user;
}
