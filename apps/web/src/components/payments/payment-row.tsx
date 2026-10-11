"use client";

import { endpoints } from "@sagarnu/api-client";
import type { PaymentFileKind } from "@sagarnu/domain";
import { formatDate, formatILS, he } from "@sagarnu/i18n";
import type { PaymentDto, PaymentFileDto } from "@sagarnu/schemas";
import { ExternalLink, FileText, Image as ImageIcon, Paperclip, Receipt, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toastError } from "@/lib/errors";
import { ACCEPT_RECEIPTS, fileErrorMessage, formatFileSize, prepareReceipt } from "@/lib/files";
import { useRefreshEvent } from "@/lib/use-refresh";

const KIND_LABEL: Record<PaymentFileKind, string> = { receipt: "קבלה", confirmation: "אישור העברה" };

function FileChip({
  file,
  editable,
  onDelete,
}: {
  file: PaymentFileDto;
  editable: boolean;
  onDelete: () => void;
}) {
  const Icon = file.mime === "application/pdf" ? FileText : ImageIcon;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-soft py-1 ps-2 pe-1 text-xs">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 hover:text-brand-600 hover:underline"
        title={`${KIND_LABEL[file.kind]} · ${formatFileSize(file.sizeBytes)}`}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="text-muted">{KIND_LABEL[file.kind]}:</span>
        <span className="truncate">{file.name}</span>
      </a>
      {editable && (
        <button
          type="button"
          aria-label={`מחיקת ${file.name}`}
          onClick={onDelete}
          className="rounded p-0.5 text-muted hover:bg-line hover:text-ink"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** One payment in the vendor panel: amount, links, attached files and "attach a file". */
export function PaymentRow({
  eventId,
  payment: p,
  scheduleLabel,
  editable,
  onDelete,
}: {
  eventId: string;
  payment: PaymentDto;
  scheduleLabel?: string;
  editable: boolean;
  onDelete: () => void;
}) {
  const refresh = useRefreshEvent(eventId);
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PaymentFileKind>("receipt");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<PaymentFileDto | null>(null);

  const attach = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { name, dataUrl } = await prepareReceipt(file);
      await endpoints.payments.uploadFile(eventId, p.id, { kind, name, dataUrl });
      await refresh();
      toast.success("הקובץ צורף");
    } catch (e) {
      const message = fileErrorMessage(e);
      if (message) toast.error(message);
      else toastError(e);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const removeFile = async () => {
    if (!deleting) return;
    try {
      await endpoints.payments.removeFile(eventId, deleting.id);
      await refresh();
      setDeleting(null);
    } catch (e) {
      toastError(e);
    }
  };

  const links = [
    { href: p.receiptUrl, label: "קבלה" },
    { href: p.confirmationUrl, label: "אישור" },
  ].filter((l): l is { href: string; label: string } => !!l.href);

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-success-soft p-2 text-success">
          <Receipt className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="num text-sm font-semibold">{formatILS(p.amountAgorot)}</p>
          <p className="text-xs text-muted">
            <span className="num">{formatDate(p.paidOn)}</span> · {he.paymentMethod[p.method]}
            {scheduleLabel && ` · ${scheduleLabel}`}
          </p>
        </div>
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-ink"
            aria-label={l.label}
            title={l.label}
          >
            <ExternalLink className="size-4" />
          </a>
        ))}
        {editable && (
          <Button size="icon" variant="ghost" aria-label="מחיקת תשלום" onClick={onDelete}>
            <X className="size-4 text-muted" />
          </Button>
        )}
      </div>

      {(p.files.length > 0 || editable) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 ps-11">
          {p.files.map((f) => (
            <FileChip key={f.id} file={f} editable={editable} onDelete={() => setDeleting(f)} />
          ))}
          {editable && (
            <>
              <input
                ref={input}
                type="file"
                accept={ACCEPT_RECEIPTS}
                className="hidden"
                onChange={(e) => attach(e.target.files?.[0])}
              />
              {(["receipt", "confirmation"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted"
                  loading={uploading && kind === k}
                  disabled={uploading}
                  onClick={() => {
                    setKind(k);
                    input.current?.click();
                  }}
                >
                  <Paperclip className="size-3" />
                  {KIND_LABEL[k]}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        danger
        title="למחוק את הקובץ?"
        description={`"${deleting?.name}" יוסר מהתשלום.`}
        confirmLabel="מחיקה"
        onConfirm={removeFile}
      />
    </li>
  );
}
