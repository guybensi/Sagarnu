"use client";

import { endpoints } from "@sagarnu/api-client";
import { daysUntil, todayIso } from "@sagarnu/domain";
import { formatDate, formatNumber } from "@sagarnu/i18n";
import type { EventDto } from "@sagarnu/schemas";
import { CalendarPlus, Camera, ImagePlus, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toastError } from "@/lib/errors";
import { useCan } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";

/** Phone photos are several MB; a 1600px JPEG is plenty for a banner and stays a few hundred KB. */
async function resizeToJpeg(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Re-renders after midnight so "days left" ticks over without a reload. */
function useToday(): string {
  const [today, setToday] = useState(() => todayIso());
  useEffect(() => {
    const id = setInterval(() => setToday(todayIso()), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

function PhotoControls({ event }: { event: EventDto }) {
  const refresh = useRefreshEvent(event.id);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await endpoints.events.setCover(event.id, await resizeToJpeg(file));
      await refresh();
      toast.success("התמונה נשמרה");
    } catch (e) {
      if (e instanceof DOMException || e instanceof TypeError)
        toast.error("לא הצלחנו לקרוא את התמונה. נסו קובץ JPG או PNG");
      else toastError(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await endpoints.events.removeCover(event.id);
      await refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute end-4 top-4 z-10 flex gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() => input.current?.click()}
        className="border-0 bg-white/20 text-white backdrop-blur hover:bg-white/30"
      >
        {event.coverPhotoUrl ? <Camera className="size-4" /> : <ImagePlus className="size-4" />}
        {event.coverPhotoUrl ? "החלפת תמונה" : "הוספת תמונה"}
      </Button>
      {event.coverPhotoUrl && (
        <Button
          size="icon"
          variant="secondary"
          aria-label="הסרת התמונה"
          disabled={busy}
          onClick={remove}
          className="size-8 border-0 bg-white/20 text-white backdrop-blur hover:bg-white/30"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function EventHero({ event }: { event: EventDto }) {
  const today = useToday();
  const canEdit = useCan("event.edit");
  const days = event.eventDate ? daysUntil(event.eventDate, today) : null;
  const photo = event.coverPhotoUrl;

  return (
    <div
      className={cn(
        "relative flex min-h-64 flex-col justify-end overflow-hidden rounded-card p-6 text-white shadow-card sm:p-8",
        !photo && "bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))]",
      )}
    >
      {photo ? (
        <>
          <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
        </>
      ) : (
        <svg className="absolute -end-10 -top-10 size-56 opacity-10" viewBox="0 0 32 32" aria-hidden>
          <circle cx="12" cy="16" r="8" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="20" cy="16" r="8" fill="none" stroke="white" strokeWidth="1.5" />
        </svg>
      )}

      {canEdit && <PhotoControls event={event} />}

      <div className="relative">
        <p className="text-sm text-white/85">{event.name}</p>

        {days == null ? (
          <>
            <h2 className="mt-1 text-2xl font-bold">עוד לא נקבע תאריך</h2>
            <p className="mt-1 text-sm text-white/80">כשתקבעו תאריך תופיע כאן ספירה לאחור</p>
            <Link href={`/e/${event.id}/details`}>
              <Button variant="secondary" className="mt-5 border-0">
                <CalendarPlus className="size-4" />
                הזנת תאריך
              </Button>
            </Link>
          </>
        ) : days > 0 ? (
          <p className="mt-1 flex items-baseline gap-3">
            <span className="num text-6xl font-bold tracking-tight sm:text-7xl">{formatNumber(days)}</span>
            <span className="text-xl font-medium">{days === 1 ? "יום אחד לחתונה" : "ימים לחתונה"}</span>
          </p>
        ) : (
          <h2 className="mt-1 text-4xl font-bold">{days === 0 ? "היום מתחתנים! 💍" : "מזל טוב! 🎉"}</h2>
        )}

        {event.eventDate && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
            <span className="num">
              {formatDate(event.eventDate)}
              {event.eventTime && ` · ${event.eventTime}`}
            </span>
            {(event.venueName || event.city) && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {[event.venueName, event.city].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
