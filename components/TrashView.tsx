"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { emptyTrash, purge, restore, type Trashable } from "@/app/actions";
import { GOLD } from "@/lib/constants";
import { relative } from "@/lib/format";

export type TrashRow = {
  id: string;
  entity: Trashable;
  label: string;
  sub: string;
  deleted_at: string;
};

const ENTITY_LABEL: Record<Trashable, string> = {
  contacts: "Contacto",
  companies: "Empresa",
  deals: "Deal",
  activities: "Actividad",
};

const ENTITY_ICON: Record<Trashable, string> = {
  contacts: "◍",
  companies: "▤",
  deals: "▦",
  activities: "≡",
};

export default function TrashView({
  rows,
  isAdmin,
  canWrite,
}: {
  rows: TrashRow[];
  isAdmin: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [filter, setFilter] = useState<"all" | Trashable>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = rows.filter((r) => filter === "all" || r.entity === filter);
  const counts = {
    all: rows.length,
    contacts: rows.filter((r) => r.entity === "contacts").length,
    companies: rows.filter((r) => r.entity === "companies").length,
    deals: rows.filter((r) => r.entity === "deals").length,
    activities: rows.filter((r) => r.entity === "activities").length,
  };

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

  /** Agrupa la selección por entidad para llamar a la acción una vez por tabla. */
  function grouped() {
    const map = new Map<Trashable, string[]>();
    rows
      .filter((r) => selected.has(r.id))
      .forEach((r) => map.set(r.entity, [...(map.get(r.entity) ?? []), r.id]));
    return Array.from(map.entries());
  }

  function restoreSelected() {
    run(async () => {
      for (const [entity, ids] of grouped()) await restore(entity, ids);
    }, `${selected.size} elementos restaurados.`);
  }

  async function purgeSelected() {
    const ok = await confirm({
      title: `Borrar ${selected.size} elementos definitivamente`,
      message: "Esto sí es irreversible: no se podrán recuperar.",
      confirmLabel: "Borrar para siempre",
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      for (const [entity, ids] of grouped()) await purge(entity, ids);
    }, `${selected.size} elementos borrados.`);
  }

  function rowMenu(r: TrashRow): MenuItem[] {
    if (!canWrite) return [{ kind: "label", label: r.label }];
    return [
      { kind: "label", label: r.label },
      {
        label: "Restaurar",
        icon: "↩",
        onSelect: () => run(() => restore(r.entity, [r.id]), "Restaurado."),
      },
      { kind: "separator" },
      {
        label: "Borrar definitivamente",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: "Borrar definitivamente",
            message: `"${r.label}" no se podrá recuperar.`,
            confirmLabel: "Borrar para siempre",
            danger: true,
          });
          if (ok) run(() => purge(r.entity, [r.id]), "Borrado definitivamente.");
        },
      },
    ];
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {(
          [
            ["all", "Todo"],
            ["contacts", "Contactos"],
            ["companies", "Empresas"],
            ["deals", "Deals"],
            ["activities", "Actividades"],
          ] as const
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key as "all" | Trashable)}
              className="rounded-full px-[15px] py-2 text-[12.5px] font-medium transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {label} <span className="tnum ml-[3px] opacity-65">{counts[key]}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        {isAdmin && rows.length > 0 && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: "Vaciar la papelera",
                message: `Se borrarán definitivamente los ${rows.length} elementos. No se pueden recuperar.`,
                confirmLabel: "Vaciar papelera",
                danger: true,
              });
              if (ok) run(() => emptyTrash(), "Papelera vaciada.");
            }}
            className="rounded-[9px] border border-[rgba(255,143,122,0.3)] px-3.5 py-2 text-[12.5px] text-[#FF8F7A] transition-colors hover:bg-[rgba(255,143,122,0.1)]"
          >
            Vaciar papelera
          </button>
        )}
      </div>

      {selected.size > 0 && canWrite && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[11px] border border-[rgba(250,197,28,0.3)] bg-[rgba(250,197,28,0.06)] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-gold">
            {selected.size} seleccionados
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11.5px] text-ink-350 hover:text-ink-50"
          >
            Deseleccionar
          </button>
          <button
            onClick={restoreSelected}
            className="rounded-full bg-gold px-3.5 py-1 text-[11.5px] font-semibold text-ink-950"
          >
            Restaurar
          </button>
          <button
            onClick={purgeSelected}
            className="rounded-full bg-[#FF8F7A] px-3.5 py-1 text-[11.5px] font-semibold text-ink-950"
          >
            Borrar para siempre
          </button>
        </div>
      )}

      <div className="panel mt-4 overflow-hidden">
        {visible.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="text-[15px] font-semibold">La papelera está vacía</div>
            <div className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-[1.6] text-ink-350">
              Todo lo que borres desde cualquier pantalla aterriza aquí primero. Nada se pierde
              hasta que lo borres definitivamente.
            </div>
          </div>
        )}

        {visible.map((r) => (
          <div
            key={r.id}
            onContextMenu={(e) => openMenu(e, rowMenu(r))}
            className="flex items-center gap-3 border-b border-[rgba(245,245,245,0.05)] px-5 py-3"
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() =>
                setSelected((prev) => {
                  const n = new Set(prev);
                  if (n.has(r.id)) n.delete(r.id);
                  else n.add(r.id);
                  return n;
                })
              }
              className="h-[13px] w-[13px] accent-[#FAC51C]"
            />
            <span className="w-[16px] text-center text-[12px] text-ink-500">
              {ENTITY_ICON[r.entity]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{r.label}</div>
              <div className="truncate text-[11.5px] text-ink-400">{r.sub}</div>
            </div>
            <span className="rounded border border-hair bg-ink-800 px-2 py-[2px] text-[10.5px] text-ink-350">
              {ENTITY_LABEL[r.entity]}
            </span>
            <span className="w-[110px] text-right text-[11.5px] text-ink-400">
              {relative(r.deleted_at)}
            </span>
            {canWrite && (
              <button
                onClick={() => run(() => restore(r.entity, [r.id]), "Restaurado.")}
                className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
              >
                Restaurar
              </button>
            )}
            <button
              onClick={(e) => openMenu(e, rowMenu(r))}
              className="text-[15px] text-ink-500 transition-colors hover:text-gold"
            >
              ⋯
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11.5px] text-ink-500">
        Restaurar devuelve el elemento a su sitio con sus relaciones intactas. Borrar
        definitivamente sí es irreversible.
      </div>
    </div>
  );
}
