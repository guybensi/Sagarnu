"use client";

import { he } from "@sagarnu/i18n";
import { FileText, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCEPT_RECEIPTS, fileErrorMessage, prepareReceipt } from "@/lib/files";

export interface PickedFile {
  name: string;
  dataUrl: string;
}

/** "Upload a file" next to a link field. The file is converted on pick, so errors show immediately. */
export function FilePick({
  value,
  onChange,
  label = he.ui.uploadFile,
}: {
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await prepareReceipt(file));
    } catch (e) {
      toast.error(fileErrorMessage(e) ?? he.ui.fileUnreadable);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_RECEIPTS}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {value ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-brand-50 py-1 ps-2.5 pe-1 text-xs text-brand-700">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{value.name}</span>
          <button
            type="button"
            aria-label={he.common.remove(value.name)}
            onClick={() => onChange(null)}
            className="rounded p-0.5 hover:bg-brand-100"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : (
        <Button type="button" size="sm" variant="ghost" loading={busy} onClick={() => input.current?.click()}>
          <Paperclip className="size-3.5" />
          {label}
        </Button>
      )}
    </div>
  );
}
