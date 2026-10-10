"use client";

import { endpoints, useCategories, useContracts } from "@sagarnu/api-client";
import { formatILS, he } from "@sagarnu/i18n";
import type { ContractDto } from "@sagarnu/schemas";
import { FilePlus2, FileText, PenLine, Plus, Sparkles, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ContractDialog } from "@/components/contracts/contract-dialog";
import { contractTone } from "@/components/contracts/status";
import { VendorDrawer } from "@/components/contracts/vendor-drawer";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { messageOf, toastError } from "@/lib/errors";
import { useCan, useEventId } from "@/lib/use-event-id";
import { useRefreshEvent } from "@/lib/use-refresh";

function ContractCard({ contract, onOpen }: { contract: ContractDto; onOpen: () => void }) {
  const paidPct =
    contract.totalAmountAgorot && contract.totalAmountAgorot > 0
      ? Math.min(100, (contract.paidAgorot / contract.totalAmountAgorot) * 100)
      : 0;
  return (
    <button onClick={onOpen} className="text-start">
      <Card className="h-full transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{contract.vendorName}</p>
          <Badge tone={contractTone[contract.status]}>{he.contractStatus[contract.status]}</Badge>
        </div>
        <p className="num mt-3 text-2xl font-bold">{formatILS(contract.totalAmountAgorot, "ללא סכום")}</p>
        {contract.status === "approved" && contract.totalAmountAgorot != null && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-success" style={{ width: `${paidPct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              שולם <span className="num">{formatILS(contract.paidAgorot)}</span> · נותר{" "}
              <span className="num">{formatILS(contract.remainingAgorot)}</span>
            </p>
          </>
        )}
        {contract.vendorContactName && (
          <p className="mt-2 text-xs text-muted">{contract.vendorContactName}</p>
        )}
      </Card>
    </button>
  );
}

function NewCategoryDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const refresh = useRefreshEvent(eventId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const c = await endpoints.categories.create(eventId, { name: name.trim() });
      await refresh();
      setName("");
      onOpenChange(false);
      onCreated(c.id);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="קטגוריה חדשה"
      footer={
        <Button onClick={save} loading={saving}>
          הוספה
        </Button>
      }
    >
      <Field label="שם הקטגוריה" htmlFor="catName">
        <Input
          id="catName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: צלם מגנטים"
          autoFocus
        />
      </Field>
    </Dialog>
  );
}

function ContractsView() {
  const eventId = useEventId();
  const params = useSearchParams();
  const categories = useCategories(eventId);
  const contracts = useContracts(eventId);
  const canWrite = useCan("contract.write");
  const [tab, setTab] = useState<string>(params.get("category") ?? "all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [chooser, setChooser] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contracts.data ?? []) m.set(c.categoryId, (m.get(c.categoryId) ?? 0) + 1);
    return m;
  }, [contracts.data]);

  if (categories.isPending || contracts.isPending) return <Spinner />;
  if (categories.error || contracts.error)
    return <p className="text-danger">{messageOf(categories.error ?? contracts.error)}</p>;

  // Relevant categories, plus any that already have contracts.
  const visible = categories.data.filter((c) => c.isRelevant || counts.has(c.id));
  const list = contracts.data.filter((c) => tab === "all" || c.categoryId === tab);
  const categoryName = (id: string) => categories.data.find((c) => c.id === id)?.nameHe ?? "";

  const tabs = [
    { id: "all", nameHe: "הכל", count: contracts.data.length },
    ...visible.map((c) => ({ id: c.id, nameHe: c.nameHe, count: counts.get(c.id) ?? 0 })),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">חוזים</h1>
          <p className="text-sm text-muted">כל ההצעות והחוזים מהספקים, לפי קטגוריה</p>
        </div>
        {canWrite && (
          <Button onClick={() => setChooser(true)}>
            <FilePlus2 className="size-4" />
            חוזה חדש
          </Button>
        )}
      </div>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
              tab === t.id
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line bg-surface hover:bg-soft",
            )}
          >
            {t.nameHe}
            {t.count > 0 && (
              <span
                className={cn(
                  "num rounded-full px-1.5 text-xs",
                  tab === t.id ? "bg-white/25" : "bg-soft text-muted",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
        {canWrite && (
          <button
            onClick={() => setNewCategory(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:bg-soft"
          >
            <Plus className="size-3.5" />
            קטגוריה
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title={tab === "all" ? "עוד אין חוזים" : `עוד אין חוזים ב${categoryName(tab)}`}
          description="הוסיפו הצעת מחיר או חוזה חתום כדי לעקוב אחרי תשלומים ותזכורות"
          action={
            canWrite && (
              <Button onClick={() => setChooser(true)}>
                <FilePlus2 className="size-4" />
                חוזה חדש
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              {tab === "all" && <span className="ps-1 text-xs text-muted">{categoryName(c.categoryId)}</span>}
              <ContractCard contract={c} onOpen={() => setOpenId(c.id)} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={chooser} onOpenChange={setChooser} title="איך מוסיפים את החוזה?">
        <div className="grid gap-3">
          <button
            disabled
            className="flex items-start gap-4 rounded-2xl border border-line p-4 text-start opacity-60"
            title="בקרוב"
          >
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-500">
              <Upload className="size-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                העלאת קובץ{" "}
                <Badge tone="brand">
                  <Sparkles className="size-3" />
                  בקרוב
                </Badge>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                PDF או Word, וה-AI ימלא את הפרטים ואת פריסת התשלומים
              </p>
            </div>
          </button>
          <button
            onClick={() => {
              setChooser(false);
              setCreating(true);
            }}
            className="flex items-start gap-4 rounded-2xl border border-line p-4 text-start hover:border-brand-200 hover:bg-brand-50/40"
          >
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-500">
              <PenLine className="size-5" />
            </div>
            <div>
              <p className="font-semibold">הזנה ידנית</p>
              <p className="mt-0.5 text-sm text-muted">ממלאים ספק, סכום ומועדי תשלום</p>
            </div>
          </button>
        </div>
      </Dialog>

      <ContractDialog
        eventId={eventId}
        contract={null}
        defaultCategoryId={tab === "all" ? undefined : tab}
        open={creating}
        onOpenChange={setCreating}
        onSaved={(c) => setOpenId(c.id)}
      />
      <NewCategoryDialog
        eventId={eventId}
        open={newCategory}
        onOpenChange={setNewCategory}
        onCreated={setTab}
      />
      <VendorDrawer eventId={eventId} contractId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ContractsView />
    </Suspense>
  );
}
