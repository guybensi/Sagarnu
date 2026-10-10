import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-brand-50),transparent_60%)] px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-3xl bg-surface p-7 shadow-card sm:p-9">{children}</div>
      <p className="mt-6 text-xs text-muted">כל התקציב, החוזים והתשלומים של החתונה במקום אחד</p>
    </div>
  );
}
