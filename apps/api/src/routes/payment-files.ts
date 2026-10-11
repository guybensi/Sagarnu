import { schema } from "@sagarnu/db";
import {
  PAYMENT_FILE_MAX_BYTES,
  PAYMENT_FILES_PER_PAYMENT,
  paymentFileUploadSchema,
  type PaymentFileDto,
} from "@sagarnu/schemas";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { assertUuid, eventAccess } from "../lib/access";
import { audit } from "../lib/audit";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";
import { contentDisposition, decodeDataUrl, sniffFile } from "../lib/files";
import { toPaymentFileDto } from "../lib/mappers";
import { FILE_META } from "../services/ledger";

const { payment, paymentFile } = schema;

type Params = { eventId: string };

/** Receipts and transfer confirmations attached to a payment (stored in Postgres until R2). */
export async function paymentFileRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  app.post<{ Params: Params & { paymentId: string } }>(
    "/v1/events/:eventId/payments/:paymentId/files",
    // Base64 adds a third on top of the file size.
    { bodyLimit: Math.ceil((PAYMENT_FILE_MAX_BYTES * 4) / 3) + 4096 },
    async (req, reply): Promise<PaymentFileDto> => {
      const me = currentUser(req);
      const { event: ev } = await eventAccess(req, req.params.eventId, "payment.write");
      const paymentId = assertUuid(req.params.paymentId);
      const input = paymentFileUploadSchema.parse(req.body);

      const bytes = decodeDataUrl(input.dataUrl);
      const mime = sniffFile(bytes);
      if (!mime || bytes.length === 0 || bytes.length > PAYMENT_FILE_MAX_BYTES) {
        throw new AppError("validation_failed", { field: "dataUrl" });
      }

      const row = await db.transaction(async (tx) => {
        const [p] = await tx
          .select({ id: payment.id })
          .from(payment)
          .where(and(eq(payment.id, paymentId), eq(payment.eventId, ev.id), isNull(payment.deletedAt)));
        if (!p) throw notFound();
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(paymentFile)
          .where(eq(paymentFile.paymentId, p.id));
        if (n >= PAYMENT_FILES_PER_PAYMENT)
          throw new AppError("conflict", { limit: PAYMENT_FILES_PER_PAYMENT });

        const [created] = await tx
          .insert(paymentFile)
          .values({
            paymentId: p.id,
            eventId: ev.id,
            kind: input.kind,
            name: input.name,
            mime,
            sizeBytes: bytes.length,
            data: bytes,
            uploadedBy: me.id,
          })
          .returning(FILE_META);
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "payment",
          entityId: p.id,
          action: "update",
          diff: { file: [null, { kind: input.kind, name: input.name }] },
        });
        return created!;
      });

      reply.status(201);
      return toPaymentFileDto(row);
    },
  );

  app.get<{ Params: Params & { fileId: string } }>(
    "/v1/events/:eventId/files/:fileId",
    async (req, reply) => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
      const [file] = await db
        .select()
        .from(paymentFile)
        .where(and(eq(paymentFile.id, assertUuid(req.params.fileId)), eq(paymentFile.eventId, ev.id)));
      if (!file) throw notFound();
      return (
        reply
          .header("Content-Type", file.mime)
          .header("Content-Disposition", contentDisposition(file.name, "inline"))
          .header("X-Content-Type-Options", "nosniff")
          // Uploaded files never get to run scripts in our origin (e.g. PDF JavaScript).
          .header(
            "Content-Security-Policy",
            "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
          )
          .header("Cache-Control", "private, max-age=3600")
          .send(file.data)
      );
    },
  );

  app.delete<{ Params: Params & { fileId: string } }>(
    "/v1/events/:eventId/files/:fileId",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await eventAccess(req, req.params.eventId, "payment.write");
      const deleted = await db
        .delete(paymentFile)
        .where(and(eq(paymentFile.id, assertUuid(req.params.fileId)), eq(paymentFile.eventId, ev.id)))
        .returning({ paymentId: paymentFile.paymentId, name: paymentFile.name });
      if (deleted.length === 0) throw notFound();
      await audit(db, {
        eventId: ev.id,
        actorId: me.id,
        entity: "payment",
        entityId: deleted[0]!.paymentId,
        action: "update",
        diff: { file: [deleted[0]!.name, null] },
      });
      reply.status(204);
    },
  );
}
