import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold text-ink", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <circle cx="12" cy="16" r="8" fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" />
        <circle cx="20" cy="16" r="8" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
      </svg>
      <span className="text-xl tracking-tight">סגרנו</span>
    </span>
  );
}
