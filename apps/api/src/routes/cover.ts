import { schema } from "@sagarnu/db";
import { COVER_PHOTO_MAX_BYTES, coverPhotoSchema } from "@sagarnu/schemas";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { eventAccess } from "../lib/access";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";
import { decodeDataUrl, sniffImage } from "../lib/files";
import { toEventDto } from "../lib/mappers";

const { event, eventCoverPhoto } = schema;

type Params = { eventId: string };

export async function coverRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  app.put<{ Params: Params }>(
    "/v1/events/:eventId/cover",
    // Base64 adds a third on top of the image size.
    { bodyLimit: Math.ceil((COVER_PHOTO_MAX_BYTES * 4) / 3) + 4096 },
    async (req) => {
      const me = currentUser(req);
      const { event: ev, role } = await eventAccess(req, req.params.eventId, "event.edit");
      const { dataUrl } = coverPhotoSchema.parse(req.body);
      const bytes = decodeDataUrl(dataUrl);
      const mime = sniffImage(bytes);
      if (!mime || bytes.length > COVER_PHOTO_MAX_BYTES) {
        throw new AppError("validation_failed", { field: "dataUrl" });
      }

      const now = new Date();
      const updated = await db.transaction(async (tx) => {
        await tx
          .insert(eventCoverPhoto)
          .values({ eventId: ev.id, mime, data: bytes, uploadedBy: me.id })
          .onConflictDoUpdate({
            target: eventCoverPhoto.eventId,
            set: { mime, data: bytes, uploadedBy: me.id, updatedAt: now },
          });
        const [row] = await tx
          .update(event)
          .set({ coverPhotoUpdatedAt: now })
          .where(eq(event.id, ev.id))
          .returning();
        return row!;
      });
      return toEventDto(updated, role);
    },
  );

  app.get<{ Params: Params }>("/v1/events/:eventId/cover", async (req, reply) => {
    const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
    const [photo] = await db.select().from(eventCoverPhoto).where(eq(eventCoverPhoto.eventId, ev.id));
    if (!photo) throw notFound();
    // URLs carry ?v=<updatedAt>, so a long private cache is safe.
    return reply
      .header("Content-Type", photo.mime)
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(photo.data);
  });

  app.delete<{ Params: Params }>("/v1/events/:eventId/cover", async (req) => {
    const { event: ev, role } = await eventAccess(req, req.params.eventId, "event.edit");
    const updated = await db.transaction(async (tx) => {
      await tx.delete(eventCoverPhoto).where(eq(eventCoverPhoto.eventId, ev.id));
      const [row] = await tx
        .update(event)
        .set({ coverPhotoUpdatedAt: null })
        .where(eq(event.id, ev.id))
        .returning();
      return row!;
    });
    return toEventDto(updated, role);
  });
}
