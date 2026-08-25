"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import {
  addActivity,
  bulkDeleteActivities,
  deleteActivity,
  snoozeActivity,
  toggleActivityCompleted,
} from "@/app/actions";
import { ACTIVITY_KINDS, GOLD } from "@/lib/constants";
import type { Activity, Contact, Deal } from "@/lib/types";

type Groups = {
  overdue: Activity[];
  today: Activity[];
  week: Activity[];
  later: Activity[];
  done: Activity[];
  pendingCount: number;
};

const GROUP_META: { key: keyof Groups; title: string; color: string; hint: string }[] = [
  { key: "overdue", title: "Vencidas", color: "#FF8F7A", hint: "Necesitan acción ya" },
  { key: "today", title: "Hoy", color: GOLD, hint: "Para cerrar en el día" },
  { key: "week", title: "Esta semana", color: "#F5F5F5", hint: "Próximos 7 días" },
  { key: "later", title: "Más adelante", color: "#8A8A8A", hint: "Planificadas" },
  { key: "done", title: "Completadas", color: "#6E6E6E", hint: "Últimas 25" },
];

export default function TaskList({
  groups,
  contacts,
  deals,
  openNew,
}: {
  groups: Groups;
  contacts: Pick<Contact, "id" | "name">[];
  deals: Pick<Deal, "id" | "name">[];
  openNew: boolean;
}) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [showForm, setShowForm] = useState(openNew);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function run(fn: () => Promise<{ error?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function taskMenu(t: Activity): MenuItem[] {
    return [
      { kind: "label", label: t.title },
      {
        label: t.completed ? "Marcar como pendiente" : "Marcar como completada",
        icon: "✓",
        onSelect: () =>
          run(() => toggleActivityCompleted(t.id, !t.completed), "Tarea actualizada."),
      },
      { kind: "separator" },
      { kind: "label", label: "Posponer" },
      { label: "1 día", icon: "→", onSelect: () => run(() => snoozeActivity(t.id, 1), "Pospuesta 1 día.") },
      { label: "3 días", icon: "→", onSelect: () => run(() => snoozeActivity(t.id, 3), "Pospuesta 3 días.") },
      { label: "1 semana", icon: "→", onSelect: () => run(() => snoozeActivity(t.id, 7), "Pospuesta 1 semana.") },
      { kind: "separator" },
      {
        label: "Abrir contacto",
        icon: "◍",
        disabled: !t.contact_id,
        onSelect: () => router.push(`/contacts/${t.contact_id}`),
      },
      {
        label: "Abrir deal",
        icon: "▦",
        disabled: !t.deal_id,
        onSelect: () => router.push(`/deals/${t.deal_id}`),
      },
      {
        label: "Copiar título",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(t.title);
          toast("Copiado.");
        },
      },
      { kind: "separator" },
      {
        label: "Eliminar tarea",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: "Eliminar tarea",
            message: t.title,
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteActivity(t.id), "Tarea eliminada.");
        },
      },
    ];
  }

  return (
    <div
      onContextMenu={(e) =>
        openMenu(e, [
          { kind: "label", label: "Tareas" },
          { label: "Nueva tarea", icon: "＋", onSelect: () => setShowForm(true) },
          {
            label: "Completar vencidas",
            icon: "✓",
            disabled: groups.overdue.length === 0,
            onSelect: () =>
              run(async () => {
                for (const t of groups.overdue) await toggleActivityCompleted(t.id, true);
              }, "Vencidas completadas."),
          },
          {
            label: "Posponer vencidas 1 día",
            icon: "→",
            disabled: groups.overdue.length === 0,
            onSelect: () =>
              run(async () => {
                for (const t of groups.overdue) await snoozeActivity(t.id, 1);
              }, "Vencidas pospuestas."),
          },
        ])
      }
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-[9px] bg-gold px-4 py-2.5 text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
        >
          {showForm ? "Cerrar" : "+ Nueva tarea"}
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-[12.5px] text-gold">{selected.size} seleccionadas</span>
            <button
              onClick={() =>
                run(async () => {
                  for (const id of Array.from(selected)) await toggleActivityCompleted(id, true);
                }, "Tareas completadas.")
              }
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 hover:border-gold hover:text-gold"
            >
              Completar
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar ${selected.size} tareas`,
                  confirmLabel: "Eliminar",
                  danger: true,
                });
                if (ok)
                  run(() => bulkDeleteActivities(Array.from(selected)), "Tareas eliminadas.");
              }}
              className="rounded-full bg-[#FF8F7A] px-3 py-1 text-[11.5px] font-semibold text-ink-950"
            >
              Eliminar
            </button>
          </>
        )}
        <div className="flex-1" />
        <div className="text-[12px] text-ink-400">
          {groups.pendingCount} pendientes · {groups.overdue.length} vencidas
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            start(async () => {
              const res = await addActivity(fd);
              if (res?.error) toast(res.error, "error");
              else {
                form.reset();
                toast("Tarea creada.");
                router.refresh();
              }
            });
          }}
          className="panel mt-4 p-5"
        >
          <div className="grid grid-cols-[1.6fr_0.9fr_1fr_1fr] gap-3">
            <input name="title" className="field" placeholder="Llamar a Elena para cerrar" required />
            <select name="kind" className="field" defaultValue="Tarea">
              {ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select name="contact_id" className="field" defaultValue="">
              <option value="">Sin contacto</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="deal_id" className="field" defaultValue="">
              <option value="">Sin deal</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_2fr_auto] gap-3">
            <input
              name="due_date"
              type="datetime-local"
              className="field"
              style={{ colorScheme: "dark" }}
              required
            />
            <input name="body" className="field" placeholder="Notas (opcional)" />
            <button
              type="submit"
              className="rounded-[10px] bg-gold px-6 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
            >
              Crear
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {GROUP_META.map((g) => {
          const list = groups[g.key] as Activity[];
          if (list.length === 0) return null;
          return (
            <div key={g.key} className="panel px-5 pb-3 pt-[18px]">
              <div className="flex items-baseline gap-2.5">
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: g.color }}
                />
                <span className="text-[14px] font-semibold tracking-[-0.01em]">{g.title}</span>
                <span className="tnum text-[12px] text-ink-400">{list.length}</span>
                <div className="flex-1" />
                <span className="text-[11.5px] text-ink-450">{g.hint}</span>
              </div>

              <div className="mt-2.5">
                {list.map((t) => {
                  const due = t.due_date ? new Date(t.due_date) : null;
                  return (
                    <div
                      key={t.id}
                      onContextMenu={(e) => openMenu(e, taskMenu(t))}
                      className="hair-t flex items-center gap-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                            return n;
                          })
                        }
                        className="h-[13px] w-[13px] accent-[#FAC51C]"
                      />
                      <button
                        onClick={() =>
                          run(
                            () => toggleActivityCompleted(t.id, !t.completed),
                            t.completed ? "Marcada pendiente." : "Tarea completada."
                          )
                        }
                        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border text-[10px] transition-colors"
                        style={{
                          borderColor: t.completed ? GOLD : "rgba(245,245,245,0.2)",
                          background: t.completed ? GOLD : "transparent",
                          color: "#080808",
                        }}
                      >
                        {t.completed ? "✓" : ""}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] font-medium"
                          style={{
                            color: t.completed ? "#6E6E6E" : "#F5F5F5",
                            textDecoration: t.completed ? "line-through" : "none",
                          }}
                        >
                          {t.title}
                        </div>
                        <div className="mt-[2px] flex items-center gap-2 text-[11.5px] text-ink-400">
                          <span className="rounded border border-hair bg-ink-800 px-1.5 text-[10px]">
                            {t.kind}
                          </span>
                          {t.contact && (
                            <Link
                              href={`/contacts/${t.contact.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate text-ink-350 hover:text-gold"
                            >
                              {t.contact.name}
                            </Link>
                          )}
                          {t.deal && (
                            <Link
                              href={`/deals/${t.deal.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate text-ink-350 hover:text-gold"
                            >
                              {t.deal.name}
                            </Link>
                          )}
                          {t.body && <span className="truncate">{t.body}</span>}
                        </div>
                      </div>

                      <div
                        className="tnum whitespace-nowrap text-[11.5px]"
                        style={{ color: g.key === "overdue" ? "#FF8F7A" : "#7A7A7A" }}
                      >
                        {due
                          ? due.toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>

                      <button
                        onClick={(e) => openMenu(e, taskMenu(t))}
                        className="text-[15px] text-ink-500 transition-colors hover:text-gold"
                      >
                        ⋯
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groups.pendingCount === 0 && groups.done.length === 0 && (
          <div className="panel px-6 py-14 text-center">
            <div className="text-[15px] font-semibold">Sin tareas todavía</div>
            <div className="mx-auto mt-2 max-w-[380px] text-[12.5px] leading-[1.6] text-ink-350">
              Crea una tarea con vencimiento desde aquí, o desde la ficha de cualquier contacto
              o deal. Las vencidas aparecerán marcadas en rojo en la barra lateral.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
