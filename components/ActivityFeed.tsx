"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { bulkDeleteActivities, deleteActivity, toggleActivityCompleted } from "@/app/actions";
import { ACTIVITY_KINDS, GOLD } from "@/lib/constants";
import { timelineWhen } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Activity } from "@/lib/types";

const RANGES: [string, number][] = [
  ["7 días", 7],
  ["30 días", 30],
  ["90 días", 90],
  ["Todo", 0],
];

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();

  const [kind, setKind] = useState("all");
  const [range, setRange] = useState(30);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = range ? Date.now() - range * 86_400_000 : 0;
    return activities.filter((a) => {
      if (kind !== "all" && a.kind !== kind) return false;
      if (min && new Date(a.occurred_at).getTime() < min) return false;
      if (!term) return true;
      return `${a.title} ${a.body ?? ""} ${a.author ?? ""} ${a.contact?.name ?? ""} ${
        a.deal?.name ?? ""
      }`
        .toLowerCase()
        .includes(term);
    });
  }, [activities, kind, range, q]);

  const byDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    filtered.forEach((a) => {
      const d = new Date(a.occurred_at);
      const key = d.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

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

  function menu(a: Activity): MenuItem[] {
    return [
      { kind: "label", label: a.title },
      {
        label: "Abrir contacto",
        icon: "◍",
        disabled: !a.contact_id,
        onSelect: () => router.push(`/contacts/${a.contact_id}`),
      },
      {
        label: "Abrir deal",
        icon: "▦",
        disabled: !a.deal_id,
        onSelect: () => router.push(`/deals/${a.deal_id}`),
      },
      {
        label: "Copiar contenido",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(`${a.title}\n${a.body ?? ""}`.trim());
          toast("Copiado.");
        },
      },
      ...(a.due_date
        ? [
            { kind: "separator" as const },
            {
              label: a.completed ? "Marcar como pendiente" : "Marcar como completada",
              icon: "✓",
              onSelect: () =>
                run(() => toggleActivityCompleted(a.id, !a.completed), "Actualizada."),
            },
          ]
        : []),
      { kind: "separator" },
      {
        label: "Eliminar",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: "Eliminar actividad",
            message: a.title,
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteActivity(a.id), "Actividad eliminada.");
        },
      },
    ];
  }

  return (
    <div
      onContextMenu={(e) =>
        openMenu(e, [
          { kind: "label", label: "Feed de actividad" },
          {
            label: "Exportar vista a CSV",
            icon: "↓",
            onSelect: () => {
              downloadCsv(
                "actividad.csv",
                toCsv(
                  filtered.map((a) => ({
                    fecha: a.occurred_at,
                    tipo: a.kind,
                    titulo: a.title,
                    detalle: a.body ?? "",
                    autor: a.author ?? "",
                    contacto: a.contact?.name ?? "",
                    deal: a.deal?.name ?? "",
                  }))
                )
              );
              toast(`${filtered.length} actividades exportadas.`);
            },
          },
          {
            label: "Seleccionar todo lo visible",
            icon: "☑",
            onSelect: () => setSelected(new Set(filtered.map((a) => a.id))),
          },
          {
            label: "Limpiar filtros",
            icon: "⟲",
            onSelect: () => {
              setKind("all");
              setRange(30);
              setQ("");
            },
          },
        ])
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setKind("all")}
          className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: kind === "all" ? GOLD : "#111111",
            color: kind === "all" ? "#080808" : "#B4B4B4",
            border: `1px solid ${kind === "all" ? GOLD : "rgba(245,245,245,0.1)"}`,
          }}
        >
          Todo
        </button>
        {ACTIVITY_KINDS.map((k) => {
          const active = kind === k;
          const n = activities.filter((a) => a.kind === k).length;
          if (n === 0) return null;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {k} <span className="tnum opacity-60">{n}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-3 py-1.5">
          <span className="text-[12px] text-ink-450">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en el feed…"
            className="w-[160px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
          />
        </div>
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-1.5 text-[12.5px] text-ink-150 outline-none"
        >
          {RANGES.map(([label, days]) => (
            <option key={label} value={days}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-[11px] border border-[rgba(250,197,28,0.3)] bg-[rgba(250,197,28,0.06)] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-gold">
            {selected.size} seleccionadas
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11.5px] text-ink-350 hover:text-ink-50"
          >
            Deseleccionar
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar ${selected.size} actividades`,
                confirmLabel: "Eliminar",
                danger: true,
              });
              if (ok) run(() => bulkDeleteActivities(Array.from(selected)), "Actividades eliminadas.");
            }}
            className="rounded-full bg-[#FF8F7A] px-3.5 py-1 text-[11.5px] font-semibold text-ink-950"
          >
            Eliminar
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {byDay.length === 0 && (
          <div className="panel px-6 py-14 text-center text-[12.5px] text-ink-400">
            No hay actividad en este periodo.
          </div>
        )}
        {byDay.map(([day, list]) => (
          <div key={day} className="panel px-5 pb-3 pt-[18px]">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[13.5px] font-semibold capitalize tracking-[-0.01em]">
                {day}
              </span>
              <span className="tnum text-[12px] text-ink-400">{list.length}</span>
            </div>
            <div className="mt-2">
              {list.map((a) => (
                <div
                  key={a.id}
                  onContextMenu={(e) => openMenu(e, menu(a))}
                  className="hair-t flex items-start gap-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const n = new Set(prev);
                        n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                        return n;
                      })
                    }
                    className="mt-1 h-[13px] w-[13px] accent-[#FAC51C]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="truncate text-[13px] font-medium">{a.title}</span>
                      <span className="whitespace-nowrap text-[11px] text-ink-400">
                        {timelineWhen(a.occurred_at)}
                      </span>
                    </div>
                    {a.body && (
                      <div className="mt-1 max-w-[720px] text-[12.5px] leading-[1.55] text-ink-250">
                        {a.body}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-ink-350">
                      <span className="rounded border border-hair bg-ink-800 px-1.5 py-[2px]">
                        {a.kind}
                      </span>
                      {a.author && (
                        <span className="rounded border border-hair bg-ink-800 px-1.5 py-[2px]">
                          {a.author}
                        </span>
                      )}
                      {a.contact && (
                        <Link href={`/contacts/${a.contact.id}`} className="hover:text-gold">
                          ◍ {a.contact.name}
                        </Link>
                      )}
                      {a.deal && (
                        <Link href={`/deals/${a.deal.id}`} className="hover:text-gold">
                          ▦ {a.deal.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => openMenu(e, menu(a))}
                    className="text-[15px] text-ink-500 transition-colors hover:text-gold"
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
