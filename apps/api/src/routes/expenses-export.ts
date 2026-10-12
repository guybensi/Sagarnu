import { schema } from "@sagarnu/db";
import { payerKey, todayIso, type IsoDate } from "@sagarnu/domain";
import { he, payerLabel } from "@sagarnu/i18n";
import { asc, eq, isNull, or } from "drizzle-orm";
import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { eventAccess } from "../lib/access";
import { contentDisposition } from "../lib/files";
import { loadLedger } from "../services/ledger";

const { category } = schema;
const t = he.expenses.sheet;

const MONEY = '#,##0.00 "₪"';
const DATE = "dd/mm/yyyy";
const shekels = (agorot: number | null | undefined) => (agorot == null ? null : agorot / 100);
/** Day-only ISO date → an Excel date (midnight UTC, so it never shifts a day). */
const excelDate = (d: IsoDate | null | undefined) => (d ? new Date(`${d}T00:00:00Z`) : null);

function styleSheet(sheet: ExcelJS.Worksheet, moneyColumns: string[], dateColumns: string[]) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EDE6" } };
  for (const key of moneyColumns) sheet.getColumn(key).numFmt = MONEY;
  for (const key of dateColumns) sheet.getColumn(key).numFmt = DATE;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/** The expenses table and every payment as an Excel file (Hebrew, right to left). */
export async function expensesExportRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.ctx;

  app.get<{ Params: { eventId: string }; Querystring: { payer?: string } }>(
    "/v1/events/:eventId/expenses/export",
    async (req, reply) => {
      const { event: ev } = await eventAccess(req, req.params.eventId, "event.view");
      const ledger = await loadLedger(db, ev);
      const categories = await db
        .select({ id: category.id, nameHe: category.nameHe, sortOrder: category.sortOrder })
        .from(category)
        .where(or(isNull(category.eventId), eq(category.eventId, ev.id)))
        .orderBy(asc(category.sortOrder));
      const byId = new Map(categories.map((c) => [c.id, c]));
      const contracts = new Map(ledger.contracts.map((c) => [c.id, c]));

      // `?payer=<payerKey>`: only that payer's payments, as filtered on the expenses screen.
      const filter = req.query.payer || null;
      const payments = ledger.payments
        .filter((p) => !filter || payerKey(p.payer, p.payerName) === filter)
        .sort((a, b) => a.paidOn.localeCompare(b.paidOn));
      const filterLabel =
        filter && payments[0] ? payerLabel(ev, payments[0].payer, payments[0].payerName) : null;

      const book = new ExcelJS.Workbook();
      book.creator = he.app.name;
      book.created = new Date();

      // ── Expenses: one row per approved contract ──
      const expenses = book.addWorksheet(t.expenses, {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
      });
      expenses.columns = [
        { header: t.vendor, key: "vendor", width: 26 },
        { header: t.category, key: "category", width: 20 },
        { header: t.contractTotal, key: "total", width: 16 },
        { header: filterLabel ? t.paidBy(filterLabel) : t.paid, key: "paid", width: filterLabel ? 24 : 16 },
        { header: t.left, key: "left", width: 16 },
        { header: t.nextDate, key: "nextDate", width: 14 },
        { header: t.nextAmount, key: "nextAmount", width: 18 },
        { header: t.late, key: "late", width: 10 },
      ];
      const approved = ledger
        .approved()
        .sort((a, b) => (byId.get(a.categoryId)?.sortOrder ?? 0) - (byId.get(b.categoryId)?.sortOrder ?? 0));
      for (const c of approved) {
        const dto = ledger.contractDto(c);
        const paid = filter
          ? payments.filter((p) => p.contractId === c.id).reduce((sum, p) => sum + p.amountAgorot, 0)
          : dto.paidAgorot;
        if (filter && paid === 0) continue;
        const next = ledger.nextDue(c);
        expenses.addRow({
          vendor: c.vendorName,
          category: byId.get(c.categoryId)?.nameHe ?? "",
          total: shekels(c.totalAmountAgorot),
          paid: shekels(paid),
          left: shekels(dto.remainingAgorot),
          nextDate: excelDate(next?.dueDate),
          nextAmount: shekels(next?.remainingAgorot),
          late: ledger.balance(c).overdue.length > 0 ? t.yes : null,
        });
      }
      const last = expenses.rowCount;
      if (last > 1) {
        const total = expenses.addRow({
          vendor: t.total,
          total: { formula: `SUM(C2:C${last})` },
          paid: { formula: `SUM(D2:D${last})` },
          left: { formula: `SUM(E2:E${last})` },
        });
        total.font = { bold: true };
      }
      styleSheet(expenses, ["total", "paid", "left", "nextAmount"], ["nextDate"]);

      // ── Payments: every payment, including to vendors no longer active ──
      const sheet = book.addWorksheet(t.payments, {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
      });
      sheet.columns = [
        { header: t.paidOn, key: "paidOn", width: 12 },
        { header: t.vendor, key: "vendor", width: 26 },
        { header: t.category, key: "category", width: 20 },
        { header: t.amount, key: "amount", width: 16 },
        { header: t.method, key: "method", width: 16 },
        { header: t.payer, key: "payer", width: 22 },
        { header: t.installment, key: "installment", width: 18 },
        { header: t.contractStatus, key: "status", width: 14 },
        { header: t.notes, key: "notes", width: 30 },
      ];
      for (const p of payments) {
        const c = contracts.get(p.contractId);
        if (!c) continue;
        sheet.addRow({
          paidOn: excelDate(p.paidOn),
          vendor: c.vendorName,
          category: byId.get(c.categoryId)?.nameHe ?? "",
          amount: shekels(p.amountAgorot),
          method: he.paymentMethod[p.method],
          payer: payerLabel(ev, p.payer, p.payerName),
          installment: ledger.items(c.id).find((i) => i.id === p.scheduleItemId)?.label ?? null,
          status: he.contractStatus[c.status],
          notes: p.notes,
        });
      }
      if (sheet.rowCount > 1) {
        const total = sheet.addRow({ vendor: t.total, amount: { formula: `SUM(D2:D${sheet.rowCount})` } });
        total.font = { bold: true };
      }
      styleSheet(sheet, ["amount"], ["paidOn"]);

      const buffer = Buffer.from(await book.xlsx.writeBuffer());
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(
          "Content-Disposition",
          contentDisposition(`sagarnu-expenses-${todayIso()}.xlsx`, "attachment"),
        )
        .header("Cache-Control", "no-store")
        .send(buffer);
    },
  );
}
