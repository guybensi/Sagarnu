"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

export default function EventLayout({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  return <AppShell eventId={eventId}>{children}</AppShell>;
}
