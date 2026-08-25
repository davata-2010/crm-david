"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { deleteActivity, snoozeActivity, toggleActivityCompleted } from "@/app/actions";
import { timelineWhen } from "@/lib/format";
import { GOLD } from "@/lib/constants";
import type { Activity } from "@/lib/types";

const TABS = ["Todo", "Tareas", "Llamadas", "Emails", "Reuniones", "Notas"] as const;
type Tab = (typeof TABS)[number];

const MATCH: Record<Tab, (a: Activity) => boolean> = {
  Todo: () => true,
  Tareas: (a) => !!a.due_date,
  Llamadas: (a) => a.kind === "Llamada",
  Emails: (a) => a.kind === "Email",
  Reuniones: (a) => a.kind === "Reunión",
  Notas: (a) => a.kind === "Nota",
};

export default function Timeline({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [tab, setTab] = useState<Tab>("Todo");
  const [, start] = useTransition();

  const items = activities.filter(MATCH[tab]);

  function run(fn: () => Promise<{ error?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        router.refresh();
      }
    });
  }

  function menu(e: Activity): MenuItem[] {
    return [
      { kind: "label", label: e.title },
      ...(e.due_date
        ? [
            {
              label: e.completed ? "Marcar como pendiente" : "Marcar como completada",
              icon: "✓",
              onSelect: () =>
                run(() => toggleActivityCompleted(e.id, !e.completed), "Actualizada."),
            },
            {
              label: "Posponer 1 día",
              icon: "→",
              onSelect: () => run(() => snoozeActivity(e.id, 1), "Pospuesta."),
            },
            { kind: "separator" as const },
          ]
        : []),
      {
        label: "Copiar contenido",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(`${e.title}\n${e.body ?? ""}`.trim());
          toast("Copiado.");
        },
      },
      {
        label: "Eliminar",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: "Eliminar actividad",
            message: e.title,
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteActivity(e.id), "Actividad eliminada.");
        },
      },
    ];
  }

  return (
    <div className="panel px-[26px] pb-[26px] pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
          Timeline de actividades
        </div>
        {TABS.map((t) => {
          const active = tab === t;
          const n = activities.filter(MATCH[t]).length;
          if (n === 0 && t !== "Todo") return null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-full px-3 py-1.5 text-[11.5px] transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {t} <span className="tnum opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-[22px] pl-1.5">
        {items.length === 0 && (
          <div className="py-6 text-[12.5px] text-ink-400">
            Sin actividades en esta vista.
          </div>
        )}
        {items.map((e, i) => {
          const overdue =
            e.due_date && !e.completed && new Date(e.due_date).getTime() < Date.now();
          return (
            <div
              key={e.id}
              onContextMenu={(ev) => openMenu(ev, menu(e))}
              className="grid grid-cols-[26px_1fr] gap-4"
            >
              <div className="flex flex-col items-center">
                <div
                  className="h-[11px] w-[11px] rounded-full"
                  style={{
                    border: `2px solid ${
                      overdue ? "#FF8F7A" : i === 0 ? GOLD : "#3A3A3A"
                    }`,
                    background: e.completed ? "#3A3A3A" : i === 0 ? GOLD : "#080808",
                  }}
                />
                <div className="min-h-[26px] w-px flex-1 bg-[rgba(245,245,245,0.09)]" />
              </div>

              <div className="group pb-6">
                <div className="flex items-baseline gap-2.5">
                  {e.due_date && (
                    <button
                      onClick={() =>
                        run(
                          () => toggleActivityCompleted(e.id, !e.completed),
                          e.completed ? "Marcada pendiente." : "Tarea completada."
                        )
                      }
                      className="grid h-[16px] w-[16px] shrink-0 place-items-center self-center rounded-[4px] border text-[9px]"
                      style={{
                        borderColor: e.completed ? GOLD : "rgba(245,245,245,0.22)",
                        background: e.completed ? GOLD : "transparent",
                        color: "#080808",
                      }}
                    >
                      {e.completed ? "✓" : ""}
                    </button>
                  )}
                  <span
                    className="text-[13.5px] font-semibold tracking-[-0.01em]"
                    style={{
                      textDecoration: e.completed ? "line-through" : "none",
                      color: e.completed ? "#6E6E6E" : "#F5F5F5",
                    }}
                  >
                    {e.title}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    {timelineWhen(e.occurred_at)}
                  </span>
                  {e.due_date && (
                    <span
                      className="text-[11px]"
                      style={{ color: overdue ? "#FF8F7A" : "#7A7A7A" }}
                    >
                      vence{" "}
                      {new Date(e.due_date).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={(ev) => openMenu(ev, menu(e))}
                    className="text-[13px] text-ink-500 opacity-0 transition-opacity hover:text-gold group-hover:opacity-100"
                  >
                    ⋯
                  </button>
                </div>

                {e.body && (
                  <div className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.55] text-ink-250">
                    {e.body}
                  </div>
                )}
                <div className="mt-2.5 flex gap-2">
                  <span className="rounded-md border border-hair bg-ink-800 px-2 py-[3px] text-[10.5px] text-ink-350">
                    {e.kind}
                  </span>
                  {e.author && (
                    <span className="rounded-md border border-hair bg-ink-800 px-2 py-[3px] text-[10.5px] text-ink-350">
                      {e.author}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
