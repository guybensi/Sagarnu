import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-surface p-5 shadow-card", className)} {...props} />;
}

export function CardTitle({
  children,
  action,
  icon,
}: {
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        {icon && <span className="text-brand-500">{icon}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-soft text-muted",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="rounded-full bg-brand-50 p-3 text-brand-500">{icon}</div>}
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <div className="size-8 animate-spin rounded-full border-3 border-brand-100 border-t-brand-500" />
    </div>
  );
}
