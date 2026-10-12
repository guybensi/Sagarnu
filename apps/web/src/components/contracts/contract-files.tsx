"use client";

import { endpoints, useContract } from "@sagarnu/api-client";
import { he } from "@sagarnu/i18n";
import { CONTRACT_FILES_PER_CONTRACT, type ContractFileDto } from "@sagarnu/schemas";
import { Eye, FileText, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form";
import { toastError } from "@/lib/errors";
import { ACCEPT_CONTRACTS, contractFileErrorMessage, formatFileSize, prepareContractFile } from "@/lib/files";
import { useRefreshEvent } from "@/lib/use-refresh";
import type { PickedFile } from "@/components/payments/file-pick";

const chip = "inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-soft py-1.5 ps-2.5 pe-1.5 text-xs";

/**
 * The contract document(s). For a saved contract files upload right away (edit mode only);
 * for a new one they are kept in `pending` and uploaded after the contract is created.
 */
export function ContractFiles({
  eventId,
  contractId,
  editable,
  pending,
  onPendingChange,
}: {
  eventId: string;
  contractId: string | null;
  editable: boolean;
  pending: PickedFile[];
  onPendingChange: (files: PickedFile[]) => void;
}) {
  const detail = useContract(eventId, contractId);
  const refresh = useRefreshEvent(eventId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ContractFileDto | null>(null);

  const saved = contractId ? (detail.data?.files ?? []) : [];
  const count = saved.length + pending.length;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const prepared = await prepareContractFile(file);
      if (!contractId) {
        onPendingChange([...pending, prepared]);
        return;
      }
      await endpoints.contractFiles.upload(eventId, contractId, prepared);
      await refresh();
      toast.success(he.contract.fileUploaded);
    } catch (e) {
      const message = contractFileErrorMessage(e);
      if (message) toast.error(message);
      else toastError(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await endpoints.contractFiles.remove(eventId, deleting.id);
      await refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setDeleting(null);
    }
  };

  if (!editable && saved.length === 0) return null;

  return (
    <Field
      label={he.contract.file}
      hint={editable ? he.contract.fileHint : undefined}
      className="sm:col-span-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {saved.map((f) => (
          <span key={f.id} className={chip}>
            <FileText className="size-3.5 shrink-0 text-brand-500" />
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium hover:underline"
              title={he.contract.viewFile}
            >
              {f.name}
            </a>
            <span className="num shrink-0 text-muted">{formatFileSize(f.sizeBytes)}</span>
            {editable && (
              <button
                type="button"
                aria-label={he.payments.deleteFile(f.name)}
                onClick={() => setDeleting(f)}
                className="rounded p-0.5 text-muted hover:bg-line hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}
        {pending.map((f) => (
          <span key={f.name} className={chip}>
            <FileText className="size-3.5 shrink-0 text-brand-500" />
            <span className="truncate">{f.name}</span>
            <button
              type="button"
              aria-label={he.common.remove(f.name)}
              onClick={() => onPendingChange(pending.filter((p) => p !== f))}
              className="rounded p-0.5 text-muted hover:bg-line hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {editable && count < CONTRACT_FILES_PER_CONTRACT && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT_CONTRACTS}
              className="hidden"
              aria-label={he.contract.uploadFile}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => input.current?.click()}
            >
              <Paperclip className="size-3.5" />
              {he.contract.uploadFile}
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        danger
        title={he.payments.deleteFileTitle}
        description={he.contract.deleteFileText(deleting?.name ?? "")}
        confirmLabel={he.common.delete}
        onConfirm={remove}
      />
    </Field>
  );
}

/** "View contract" in the dialog footer: opens the first uploaded file. */
export function ViewContractButton({ files }: { files: ContractFileDto[] }) {
  const first = files[0];
  if (!first) return null;
  return (
    <a href={first.url} target="_blank" rel="noopener noreferrer">
      <Button variant="ghost" type="button">
        <Eye className="size-4" />
        {he.contract.viewFile}
      </Button>
    </a>
  );
}
