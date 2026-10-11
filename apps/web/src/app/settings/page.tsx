"use client";

import { useMe } from "@sagarnu/api-client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { DataCard } from "@/components/settings/data-card";
import { PasswordCard } from "@/components/settings/password-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { SessionsCard } from "@/components/settings/sessions-card";
import { PlainShell } from "@/components/shell/plain-shell";
import { Spinner } from "@/components/ui/card";

export default function SettingsPage() {
  const me = useMe();
  return (
    <PlainShell next="/settings">
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            {/* Lucide arrows are not mirrored in RTL: "back" points right. */}
            <ChevronRight className="size-4" />
            חזרה
          </Link>
          <h1 className="text-2xl font-bold">הגדרות החשבון</h1>
        </div>
        {me.isPending ? (
          <Spinner />
        ) : (
          <>
            <ProfileCard />
            <PasswordCard />
            <SessionsCard />
            <DataCard />
          </>
        )}
      </div>
    </PlainShell>
  );
}
