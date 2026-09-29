import { useState } from "react";
import {
  Check,
  CircleDot,
  ClipboardCheck,
  FileSpreadsheet,
  Globe,
  PackageCheck,
  Pencil,
  StickyNote,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  ORDER_STAGES,
  ORDER_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  type OrderStage,
  type OrderStatus,
  formatDate,
  formatDateTime,
  formatRupees,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface OrderEvent {
  id: number;
  kind: string;
  from_value: string | null;
  to_value: string | null;
  detail: string | null;
  actor: string | null;
  admin_name: string | null;
  created_at: string;
}

const STEPS: OrderStage[] = ["preparation_pending", "in_progress", "delivery_pending", "payment_pending", "done"];

const STEP_SHORT: Record<OrderStage, string> = {
  preparation_pending: "Preparation",
  in_progress: "In progress",
  delivery_pending: "Delivery",
  payment_pending: "Payment",
  done: "Done",
  cancelled: "Cancelled",
};

const ACTORS: Record<string, string> = { customer: "Customer", import: "Spreadsheet import", system: "System" };

function stageLabel(v: string | null) {
  return v && v in ORDER_STAGES ? ORDER_STAGES[v as OrderStage].label : (v ?? "—");
}

function StageDot({ stage }: { stage: string | null }) {
  const s = stage && stage in ORDER_STAGES ? ORDER_STAGES[stage as OrderStage] : null;
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s?.dot ?? "#d4d4d8" }} />;
}

/** When each stage was last entered, from the activity log. */
function reachedAt(events: OrderEvent[]) {
  const at: Partial<Record<OrderStage, string>> = {};
  for (const e of events) if (e.kind === "stage" && e.to_value) at[e.to_value as OrderStage] = e.created_at;
  return at;
}

export function StageTracker({ stage, events }: { stage: OrderStage; events: OrderEvent[] }) {
  const at = reachedAt(events);

  if (stage === "cancelled") {
    return (
      <section className="flex items-center gap-3 rounded-2xl bg-white p-5 text-sm shadow-sm">
        <XCircle className="h-5 w-5 text-zinc-400" aria-hidden />
        <p>
          <span className="font-semibold">Cancelled</span>
          {at.cancelled && <span className="text-muted-foreground"> on {formatDateTime(at.cancelled)}</span>}
        </p>
      </section>
    );
  }

  const current = STEPS.indexOf(stage);
  return (
    <section className="rounded-2xl bg-white px-5 py-4 shadow-sm" aria-label="Order stage">
      <ol className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < current || stage === "done";
          const active = i === current && stage !== "done";
          const skipped = done && !at[step] && step !== "done";
          const colour = ORDER_STAGES[step].dot;
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-[hsl(var(--admin-accent))]" : "bg-zinc-200")}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white text-xs",
                  done && "border-[hsl(var(--admin-accent))] bg-[hsl(var(--admin-accent))] text-white",
                  !done && !active && "border-zinc-200 text-zinc-400",
                )}
                style={active ? { borderColor: colour, boxShadow: `0 0 0 4px ${colour}26` } : undefined}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : active ? (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn("mt-1.5 text-xs font-medium", active ? "text-foreground" : done ? "text-zinc-700" : "text-zinc-400")}>
                {STEP_SHORT[step]}
              </span>
              <span className="mt-0.5 min-h-[1rem] text-[11px] leading-tight text-muted-foreground">
                {active ? "Current" : skipped ? "Skipped" : at[step] ? formatDate(at[step]!.slice(0, 10)) : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function describe(e: OrderEvent): { icon: React.ReactNode; text: React.ReactNode } {
  switch (e.kind) {
    case "created":
      return {
        icon: e.actor === "customer" ? <Globe className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />,
        text: e.actor === "customer" ? "Order placed on the website" : "Order created",
      };
    case "imported":
      return { icon: <FileSpreadsheet className="h-3.5 w-3.5" />, text: "Imported from the order spreadsheet" };
    case "status":
      return {
        icon: e.to_value === "cancelled" ? <XCircle className="h-3.5 w-3.5" /> : <PackageCheck className="h-3.5 w-3.5" />,
        text: (
          <>
            Status{" "}
            {e.from_value && <>{ORDER_STATUS_LABELS[e.from_value as OrderStatus] ?? e.from_value} → </>}
            <span className="font-medium">{ORDER_STATUS_LABELS[e.to_value as OrderStatus] ?? e.to_value}</span>
          </>
        ),
      };
    case "stage":
      return {
        icon: <CircleDot className="h-3.5 w-3.5" />,
        text: (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            {e.from_value ? (
              <>
                <StageDot stage={e.from_value} />
                {stageLabel(e.from_value)} →
              </>
            ) : (
              "Stage:"
            )}
            <StageDot stage={e.to_value} />
            <span className="font-medium">{stageLabel(e.to_value)}</span>
          </span>
        ),
      };
    case "item_prepared":
      return { icon: <Check className="h-3.5 w-3.5" />, text: <>Marked prepared: <span className="font-medium">{e.detail}</span></> };
    case "item_unprepared":
      return { icon: <Undo2 className="h-3.5 w-3.5" />, text: <>Marked not prepared: <span className="font-medium">{e.detail}</span></> };
    case "work_note":
      return {
        icon: <StickyNote className="h-3.5 w-3.5" />,
        text: e.to_value ? (
          <>What's left for <span className="font-medium">{e.detail}</span>: “{e.to_value}”</>
        ) : (
          <>Cleared the note on <span className="font-medium">{e.detail}</span></>
        ),
      };
    case "delivery":
      return {
        icon: <Truck className="h-3.5 w-3.5" />,
        text: e.to_value === "delivered" ? (
          <>Marked <span className="font-medium">delivered</span>{e.detail && <> ({formatDate(e.detail)})</>}</>
        ) : (
          "Marked not delivered"
        ),
      };
    case "delivery_date":
      return {
        icon: <Truck className="h-3.5 w-3.5" />,
        text: <>Delivery date {e.from_value ? <>{formatDate(e.from_value)} → </> : "set to "}{e.to_value ? formatDate(e.to_value) : "cleared"}</>,
      };
    case "payment_added":
    case "payment_removed":
      return {
        icon: <Wallet className="h-3.5 w-3.5" />,
        text: (
          <>
            Payment {e.kind === "payment_added" ? "recorded" : "removed"}:{" "}
            <span className="font-medium">{formatRupees(Number(e.to_value ?? 0))}</span>
            {e.detail && <> · {PAYMENT_MODE_LABELS[e.detail] ?? e.detail}</>}
          </>
        ),
      };
    case "edited":
      return { icon: <Pencil className="h-3.5 w-3.5" />, text: "Order details edited" };
    default:
      return { icon: <CircleDot className="h-3.5 w-3.5" />, text: e.detail ?? e.kind };
  }
}

const COLLAPSED = 8;

export function OrderActivity({ events }: { events: OrderEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const newestFirst = [...events].reverse();
  const shown = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Activity</h2>
        <span className="text-xs text-muted-foreground">{events.length} update{events.length === 1 ? "" : "s"}</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="mt-4">
          {shown.map((e, i) => {
            const { icon, text } = describe(e);
            const last = i === shown.length - 1;
            return (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-zinc-200" />}
                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    e.kind === "stage" ? "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200" : "bg-[hsl(var(--admin-accent-light))] text-[hsl(var(--admin-accent))]",
                  )}
                >
                  {icon}
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-sm">
                  <p className="leading-snug">{text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)} · {e.admin_name ?? (e.actor ? ACTORS[e.actor] ?? e.actor : "Admin")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {newestFirst.length > COLLAPSED && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-medium text-[hsl(var(--admin-accent))] hover:underline"
        >
          {expanded ? "Show less" : `Show all ${newestFirst.length} updates`}
        </button>
      )}
    </section>
  );
}
