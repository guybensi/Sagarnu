import { schema } from "@sagarnu/db";
import {
  CONTRACT_FILE_MAX_BYTES,
  CONTRACT_FILES_PER_CONTRACT,
  contractFileUploadSchema,
  type ContractFileDto,
} from "@sagarnu/schemas";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { assertUuid, eventAccess } from "../lib/access";
import { audit } from "../lib/audit";
import { currentUser } from "../lib/context";
import { AppError, notFound } from "../lib/errors";
import { contentDisposition, decodeDataUrl, sniffContractFile } from "../lib/files";
import { toContractFileDto } from "../lib/mappers";
import { CONTRACT_FILE_META } from "../services/ledger";

const { contract, contractFile } = schema;

type Params = { eventId: string };

/** Browsers show these inline; Word files are downloaded. */
const INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** The contract document itself (stored in Postgres until R2). */
export async function contractFileRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  app.post<{ Params: Params & { contractId: string } }>(
    "/v1/events/:eventId/contracts/:contractId/files",
    // Base64 adds a third on top of the file size.
    { bodyLimit: Math.ceil((CONTRACT_FILE_MAX_BYTES * 4) / 3) + 4096 },
    async (req, reply): Promise<ContractFileDto> => {
      const me = currentUser(req);
      const { event: ev } = await eventAccess(req, req.params.eventId, "contract.write");
      const contractId = assertUuid(req.params.contractId);
      const input = contractFileUploadSchema.parse(req.body);

      const bytes = decodeDataUrl(input.dataUrl);
      const mime = sniffContractFile(bytes);
      if (!mime || bytes.length === 0 || bytes.length > CONTRACT_FILE_MAX_BYTES) {
        throw new AppError("validation_failed", { field: "dataUrl" });
      }

      const row = await db.transaction(async (tx) => {
        const [c] = await tx
          .select({ id: contract.id })
          .from(contract)
          .where(and(eq(contract.id, contractId), eq(contract.eventId, ev.id), isNull(contract.deletedAt)));
        if (!c) throw notFound();
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(contractFile)
          .where(eq(contractFile.contractId, c.id));
        if (n >= CONTRACT_FILES_PER_CONTRACT) {
          throw new AppError("conflict", { limit: CONTRACT_FILES_PER_CONTRACT });
        }

        const [created] = await tx
          .insert(contractFile)
          .values({
            contractId: c.id,
            eventId: ev.id,
            name: input.name,
            mime,
            sizeBytes: bytes.length,
            data: bytes,
            uploadedBy: me.id,
          })
          .returning(CONTRACT_FILE_META);
        await audit(tx, {
          eventId: ev.id,
          actorId: me.id,
          entity: "contract",
          entityId: c.id,
          action: "update",
          diff: { file: [null, input.name] },
        });
        return created!;
      });

      reply.status(201);
      return toContractFileDto(row);
    },
  );

  app.get<{ Params: Params & { fileId: string } }>(
    "/v1/events/:eventId/contract-files/:fileId",
    async (req, reply) => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
      const [file] = await db
        .select()
        .from(contractFile)
        .where(and(eq(contractFile.id, assertUuid(req.params.fileId)), eq(contractFile.eventId, ev.id)));
      if (!file) throw notFound();
      return (
        reply
          .header("Content-Type", file.mime)
          .header(
            "Content-Disposition",
            contentDisposition(file.name, INLINE.has(file.mime) ? "inline" : "attachment"),
          )
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
    "/v1/events/:eventId/contract-files/:fileId",
    async (req, reply) => {
      const me = currentUser(req);
      const { event: ev } = await eventAccess(req, req.params.eventId, "contract.write");
      const deleted = await db
        .delete(contractFile)
        .where(and(eq(contractFile.id, assertUuid(req.params.fileId)), eq(contractFile.eventId, ev.id)))
        .returning({ contractId: contractFile.contractId, name: contractFile.name });
      if (deleted.length === 0) throw notFound();
      await audit(db, {
        eventId: ev.id,
        actorId: me.id,
        entity: "contract",
        entityId: deleted[0]!.contractId,
        action: "update",
        diff: { file: [deleted[0]!.name, null] },
      });
      reply.status(204);
    },
  );
}
