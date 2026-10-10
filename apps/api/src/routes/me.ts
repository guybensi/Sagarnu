import { schema } from "@sagarnu/db";
import { updateMeSchema, type MeDto } from "@sagarnu/schemas";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { currentUser } from "../lib/context";
import { notFound } from "../lib/errors";

const { user } = schema;

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  const load = async (id: string): Promise<MeDto> => {
    const [row] = await db.select().from(user).where(eq(user.id, id));
    if (!row) throw notFound();
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      image: row.image,
      userType: row.userType,
      phoneE164: row.phoneE164,
      defaultEventId: row.defaultEventId,
    };
  };

  app.get("/v1/me", async (req) => load(currentUser(req).id));

  app.patch("/v1/me", async (req) => {
    const me = currentUser(req);
    const input = updateMeSchema.parse(req.body);
    if (Object.keys(input).length > 0) await db.update(user).set(input).where(eq(user.id, me.id));
    return load(me.id);
  });
}
