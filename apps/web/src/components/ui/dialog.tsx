"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

const overlay = "fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: BaseProps & { wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface shadow-xl sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
            wide ? "sm:max-w-2xl" : "sm:max-w-md",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" aria-label="סגירה">
                <X className="size-4" />
              </Button>
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Side panel on desktop (opens from the start side = right in RTL), bottom sheet on mobile. */
export function Drawer({ open, onOpenChange, title, description, children, footer }: BaseProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface shadow-xl sm:inset-y-0 sm:start-0 sm:end-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-e-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" aria-label="סגירה">
                <X className="size-4" />
              </Button>
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "אישור",
  danger,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink">{description}</div>
    </Dialog>
  );
}
