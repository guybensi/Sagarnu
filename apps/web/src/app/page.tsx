"use client";

import { useEvents, useMe } from "@sagarnu/api-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

/** Entry point: no session → login; planners → their events; no event → questionnaire; else the last event. */
export default function Home() {
  const router = useRouter();
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const me = useMe();
  const events = useEvents();

  useEffect(() => {
    if (session.isPending) return;
    if (!signedIn) return router.replace("/login");
    if (!events.data || !me.data) return;
    if (me.data.userType === "planner") return router.replace("/events");
    if (events.data.length === 0) return router.replace("/onboarding");
    const target = events.data.find((e) => e.id === me.data.defaultEventId) ?? events.data[0]!;
    router.replace(`/e/${target.id}`);
  }, [session.isPending, signedIn, events.data, me.data, router]);

  return <Spinner className="min-h-dvh" />;
}
