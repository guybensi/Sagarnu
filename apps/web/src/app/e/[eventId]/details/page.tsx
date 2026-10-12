"use client";

import { he } from "@sagarnu/i18n";
import { endpoints, keys, useCategories, useEvent } from "@sagarnu/api-client";
import { updateEventSchema, type EventDto } from "@sagarnu/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  emptyEventForm,
  PeopleFields,
  PlaceFields,
  SizeFields,
  StyleFields,
  toEventPayload,
  WhenFields,
  type EventForm,
  type FieldProps,
} from "@/components/event/event-fields";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Spinner } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { toastError } from "@/lib/errors";
import { useCan, useEventId } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";

function fromEvent(e: EventDto): EventForm {
  const form = { ...emptyEventForm };
  for (const key of Object.keys(form) as (keyof EventForm)[]) {
    (form as Record<string, unknown>)[key] = e[key] ?? (key === "name" ? "" : null);
  }
  return form;
}

function CategoriesCard({ eventId, editable }: { eventId: string; editable: boolean }) {
  const categories = useCategories(eventId);
  const refresh = useRefreshEvent(eventId);
  if (!categories.data) return null;
  return (
    <Card>
      <CardTitle>{he.details.categories}</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{he.details.categoriesHint}</p>
      <div className="flex flex-wrap gap-2">
        {categories.data.map((c) => (
          <button
            key={c.id}
            disabled={!editable}
            onClick={async () => {
              try {
                await endpoints.categories.setRelevance(eventId, c.id, !c.isRelevant);
                await refresh();
              } catch (e) {
                toastError(e);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              c.isRelevant
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line text-muted hover:bg-soft",
            )}
          >
            {c.isRelevant && <Check className="size-3.5" />}
            {c.nameHe}
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function DetailsPage() {
  const eventId = useEventId();
  const router = useRouter();
  const qc = useQueryClient();
  const event = useEvent(eventId);
  const refresh = useRefreshEvent(eventId);
  const editable = useCan("event.edit");
  const canDelete = useCan("event.delete");
  const [form, setForm] = useState<EventForm | null>(null);
  const [unknown, setUnknown] = useState<Set<keyof EventForm>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (event.data && !form) setForm(fromEvent(event.data));
  }, [event.data, form]);

  if (!form || !event.data) return <Spinner />;

  const props: FieldProps = {
    form,
    set: (key, value) => setForm((f) => f && { ...f, [key]: value }),
    unknown,
    toggleUnknown: (key, isUnknown) =>
      setUnknown((s) => {
        const next = new Set(s);
        if (isUnknown) next.add(key);
        else next.delete(key);
        return next;
      }),
  };

  const save = async () => {
    const parsed = updateEventSchema.safeParse({
      ...toEventPayload(form, unknown),
      completeQuestionnaire: true,
    });
    if (!parsed.success) return toast.error(he.details.invalidField);
    setSaving(true);
    try {
      await endpoints.events.update(eventId, parsed.data);
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: keys.events })]);
      toast.success(he.details.saved);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await endpoints.events.remove(eventId);
      qc.clear();
      router.replace("/");
    } catch (e) {
      toastError(e);
    }
  };

  const sections = [
    { title: he.details.sections.when, body: <WhenFields {...props} /> },
    { title: he.details.sections.size, body: <SizeFields {...props} /> },
    { title: he.details.sections.place, body: <PlaceFields {...props} /> },
    { title: he.details.sections.people, body: <PeopleFields {...props} /> },
    { title: he.details.sections.style, body: <StyleFields {...props} /> },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{he.details.title}</h1>
          <p className="text-sm text-muted">{he.details.subtitle}</p>
        </div>
        {editable && (
          <Button onClick={save} loading={saving}>
            {he.details.save}
          </Button>
        )}
      </div>

      <fieldset disabled={!editable} className="grid gap-5">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardTitle>{s.title}</CardTitle>
            {s.body}
          </Card>
        ))}
        <Card>
          <CardTitle>{he.details.notes}</CardTitle>
          <Field label={he.details.generalNotes} htmlFor="eventNotes">
            <Textarea
              id="eventNotes"
              value={form.notes ?? ""}
              onChange={(e) => props.set("notes", e.target.value || null)}
            />
          </Field>
        </Card>
      </fieldset>

      <CategoriesCard eventId={eventId} editable={editable} />

      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} size="lg">
            {he.details.save}
          </Button>
        </div>
      )}

      {canDelete && (
        <Card className="border border-danger/20">
          <CardTitle>{he.details.deleteEvent}</CardTitle>
          <p className="mb-4 text-sm text-muted">{he.details.deleteHint}</p>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            {he.details.deleteEvent}
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        danger
        title={he.details.deleteTitle}
        description={he.details.deleteText(event.data.name)}
        confirmLabel={he.details.deleteConfirm}
        onConfirm={remove}
      />
    </div>
  );
}
