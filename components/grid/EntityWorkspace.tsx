"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import DataGrid from "./DataGrid";
import ViewToolbar from "./ViewToolbar";
import { KanbanView, CalendarView, GalleryView } from "./AltViews";
import RecordPanel from "./RecordPanel";
import type { Row } from "./Cell";
import {
  bulkAssignContacts,
  bulkAssignDeals,
  bulkSetContactStatus,
  bulkTagContacts,
  duplicateContact,
  duplicateDeal,
  importContacts,
  mergeContacts,
  quickCreateContact,
  quickCreateRecord,
  saveView,
  softDelete,
  deleteView,
  updateRecordField,
} from "@/app/actions";
import { CONTACT_STATUSES, GOLD, LOST_REASONS, STAGES, STATUS } from "@/lib/constants";
import { downloadCsv, mapContactRow, parseCsv, toCsv } from "@/lib/csv";
import { memberName } from "@/lib/workspace-client";
import { ENTITY_SOURCE, type EntityKey, type FieldDef, type ViewConfig } from "@/lib/fields";
import type { Company, Membership, SavedView } from "@/lib/types";
import { contactHref, dealHref } from "@/lib/routes";

const LABEL: Record<EntityKey, { one: string; many: string; create: string }> = {
  contacts: { one: "contacto", many: "contactos", create: "Escribe un nombre y pulsa Intro para crear un contacto…" },
  companies: { one: "empresa", many: "empresas", create: "Escribe un nombre y pulsa Intro para crear una empresa…" },
  deals: { one: "deal", many: "deals", create: "Escribe un nombre y pulsa Intro para crear un deal…" },
};

export default function EntityWorkspace({
  entity,
  rows,
  total,
  config,
  fields,
  companies,
  members,
  tags,
  views,
  canWrite,
  currentUserId,
}: {
  entity: EntityKey;
  rows: Row[];
  total: number;
  config: ViewConfig;
  fields: FieldDef[];
  companies: Pick<Company, "id" | "name">[];
  members: Membership[];
  tags: string[];
  views: SavedView[];
  canWrite: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastIndex = useRef<number | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, Record<string, unknown>>>({});

  const words = LABEL[entity];
  const detailPath = entity === "deals" ? "/deals" : entity === "companies" ? "/companies" : "/contacts";

  /* ------------------------------------------------------------ URL --- */

  function patch(next: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const visibleKeys = config.fields.length ? config.fields : [...ENTITY_SOURCE[entity].defaults];
  const visibleFields = visibleKeys
    .map((k) => fields.find((f) => f.key === k))
    .filter(Boolean) as FieldDef[];

  const setFields = (keys: string[]) => patch({ cols: encodeURIComponent(JSON.stringify(keys)) });

  const setWidth = (key: string, width: number) => {
    const widths = { ...config.widths, [key]: width };
    const p = new URLSearchParams(params.toString());
    p.set("w", encodeURIComponent(JSON.stringify(widths)));
    window.history.replaceState(null, "", `${pathname}?${p.toString()}`);
  };

  /* -------------------------------------------------------- edición --- */

  const shown = useMemo(
    () => rows.map((r) => (optimistic[r.id] ? { ...r, ...optimistic[r.id] } : r)),
    [rows, optimistic]
  );

  function edit(id: string, key: string, value: string | string[] | null) {
    const display: Record<string, unknown> = {};
    if (key === "company_id") {
      display.company_name = companies.find((c) => c.id === value)?.name ?? null;
      display.company_id = value;
    } else if (key === "contact_id") {
      display.contact_id = value;
    } else if (key.startsWith("custom.")) {
      const row = rows.find((r) => r.id === id);
      display.custom = {
        ...((row?.custom ?? {}) as Record<string, unknown>),
        [key.slice(7)]: value,
      };
    } else {
      display[key] = key === "stage" || key === "value" ? Number(value) : value;
    }
    setOptimistic((p) => ({ ...p, [id]: { ...(p[id] ?? {}), ...display } }));

    start(async () => {
      const res = await updateRecordField(entity, id, key, value);
      if (res?.error) {
        setOptimistic((p) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
        toast(res.error, "error");
      } else {
        router.refresh();
      }
    });
  }

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

  /* ----------------------------------------------------- selección --- */

  function toggleRow(id: string, index: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex.current !== null) {
        const [a, b] = [lastIndex.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) if (shown[i]) next.add(shown[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIndex.current = index;
  }

  const ids = Array.from(selected);
  const selectedRows = shown.filter((r) => selected.has(r.id));

  /* ----------------------------------------------------------- CSV --- */

  function exportRows(list: Row[], filename: string) {
    if (!list.length) return toast("No hay filas que exportar.", "error");
    downloadCsv(
      filename,
      toCsv(
        list.map((r) => {
          const out: Record<string, unknown> = {};
          visibleFields.forEach((f) => {
            const v = f.key.startsWith("custom.")
              ? ((r.custom ?? {}) as Record<string, unknown>)[f.key.slice(7)]
              : r[f.key];
            out[f.label] =
              f.key === "assigned_to"
                ? memberName(members, (v as string) ?? null)
                : f.key === "stage"
                  ? STAGES[Number(v)]
                  : Array.isArray(v)
                    ? v.join("; ")
                    : (v ?? "");
          });
          return out;
        })
      )
    );
    toast(`${list.length} ${words.many} exportados.`);
  }

  async function onImportFile(file: File) {
    const parsed = parseCsv(await file.text()).map(mapContactRow).filter((r) => r.name);
    if (!parsed.length) return toast("No encontré ninguna columna de nombre.", "error");
    const ok = await confirm({
      title: `Importar ${parsed.length} contactos`,
      message: "Se crearán las empresas que no existan.",
      confirmLabel: "Importar",
    });
    if (ok) run(() => importContacts(parsed), `${parsed.length} contactos importados.`);
  }

  /* --------------------------------------------------------- menús --- */

  function bulkItems(): MenuItem[] {
    const common: MenuItem[] = [
      { kind: "label", label: "Asignar a" },
      ...members.map((m) => ({
        label: m.profile?.full_name || m.profile?.email || "Miembro",
        icon: "◍",
        onSelect: () =>
          run(
            () =>
              entity === "deals"
                ? bulkAssignDeals(ids, m.user_id)
                : bulkAssignContacts(ids, m.user_id),
            "Asignados."
          ),
      })),
    ];

    if (entity === "contacts")
      return [
        ...CONTACT_STATUSES.map((s) => ({
          label: `Marcar como ${STATUS[s].label}`,
          icon: "◦",
          onSelect: () => run(() => bulkSetContactStatus(ids, s), "Estado actualizado."),
        })),
        { kind: "separator" },
        ...common,
        { kind: "separator" },
        {
          label: "Añadir etiqueta…",
          icon: "⌗",
          onSelect: async () => {
            const t = window.prompt("Etiqueta:");
            if (t?.trim()) run(() => bulkTagContacts(ids, t.trim()), "Etiqueta añadida.");
          },
        },
        {
          label: "Fusionar en el primero",
          icon: "⇉",
          disabled: selected.size < 2,
          onSelect: async () => {
            const keep = selectedRows[0];
            const ok = await confirm({
              title: `Fusionar en "${keep.name}"`,
              message: "El resto pasa a la papelera; sus deals y actividades se mueven.",
              confirmLabel: "Fusionar",
            });
            if (ok)
              run(
                () => mergeContacts(keep.id, ids.filter((i) => i !== keep.id)),
                "Duplicados fusionados."
              );
          },
        },
      ];

    if (entity === "deals")
      return [
        { kind: "label", label: "Mover a etapa" },
        ...STAGES.map((label, i) => ({
          label,
          icon: "○",
          onSelect: () =>
            run(async () => {
              for (const id of ids) await updateRecordField("deals", id, "stage", String(i));
            }, `Movidos a ${label}.`),
        })),
        { kind: "separator" },
        ...common,
      ];

    return common;
  }

  function rowMenu(e: React.MouseEvent, row: Row) {
    const multi = selected.size > 1 && selected.has(row.id);
    const title = String(row.name ?? "");

    const base: MenuItem[] = [
      { kind: "label", label: multi ? `${selected.size} seleccionados` : title },
      { label: "Abrir ficha", icon: "⤢", onSelect: () => setOpenRow(row) },
      {
        label: "Abrir en pestaña nueva",
        icon: "⧉",
        onSelect: () => window.open(`${detailPath}/${row.id}`, "_blank"),
      },
    ];

    if (!canWrite) return openMenu(e, base);

    if (multi)
      return openMenu(e, [
        { kind: "label", label: `${selected.size} ${words.many}` },
        ...bulkItems(),
        { kind: "separator" },
        { label: "Exportar selección", icon: "↓", onSelect: () => exportRows(selectedRows, `${entity}-seleccion.csv`) },
        {
          label: `Mover ${selected.size} a la papelera`,
          icon: "⌫",
          danger: true,
          onSelect: async () => {
            const ok = await confirm({
              title: `Mover ${selected.size} ${words.many} a la papelera`,
              message: "Podrás restaurarlos desde Papelera.",
              confirmLabel: "Mover",
              danger: true,
            });
            if (ok) run(() => softDelete(entity, ids), `${ids.length} en la papelera.`);
          },
        },
      ]);

    const specific: MenuItem[] = [];

    if (entity === "contacts") {
      specific.push(
        {
          label: "Enviar email",
          icon: "✉",
          disabled: !row.email,
          onSelect: () => (window.location.href = `mailto:${row.email}`),
        },
        { label: "Crear deal", icon: "＋", onSelect: () => router.push(`/deals/new?contact=${row.id}`) },
        { label: "Añadir tarea", icon: "✓", onSelect: () => router.push(`${contactHref(row.id)}&task=1`) },
        { kind: "separator" },
        { kind: "label", label: "Cambiar estado" },
        ...CONTACT_STATUSES.map((s) => ({
          label: STATUS[s].label,
          icon: row.status === s ? "●" : "○",
          disabled: row.status === s,
          onSelect: () => edit(row.id, "status", s),
        }))
      );
    }

    if (entity === "deals") {
      specific.push(
        {
          label: "Abrir contacto",
          icon: "◍",
          disabled: !row.contact_id,
          onSelect: () => router.push(contactHref(row.contact_id as string)),
        },
        { label: "Añadir tarea", icon: "✓", onSelect: () => router.push(`${dealHref(row.id)}&task=1`) },
        { kind: "separator" },
        { kind: "label", label: "Mover a etapa" },
        ...STAGES.map((label, i) => ({
          label,
          icon: Number(row.stage) === i ? "●" : "○",
          disabled: Number(row.stage) === i,
          onSelect: () => edit(row.id, "stage", String(i)),
        })),
        {
          label: "Marcar perdido con motivo…",
          icon: "✕",
          onSelect: () =>
            openMenu(e, [
              { kind: "label", label: "Motivo de la pérdida" },
              ...LOST_REASONS.map((reason) => ({
                label: reason,
                icon: "○",
                onSelect: () =>
                  start(async () => {
                    await updateRecordField("deals", row.id, "stage", "6");
                    await updateRecordField("deals", row.id, "lost_reason", reason);
                    toast("Marcado como perdido.");
                    router.refresh();
                  }),
              })),
            ]),
        }
      );
    }

    if (entity === "companies") {
      specific.push(
        {
          label: "Abrir web",
          icon: "🌐",
          disabled: !row.website,
          onSelect: () => {
            const url = String(row.website).startsWith("http")
              ? String(row.website)
              : `https://${row.website}`;
            window.open(url, "_blank");
          },
        },
        { label: "Nuevo contacto aquí", icon: "＋", onSelect: () => router.push(`/contacts/new?company=${row.id}`) },
        { label: "Nuevo deal aquí", icon: "＋", onSelect: () => router.push(`/deals/new?company=${row.id}`) }
      );
    }

    openMenu(e, [
      ...base,
      { label: "Editar ficha completa", icon: "✎", onSelect: () => router.push(`${detailPath}/${row.id}?edit=1`) },
      ...(entity !== "companies"
        ? [
            {
              label: "Duplicar",
              icon: "⧉",
              onSelect: () =>
                run(
                  () => (entity === "deals" ? duplicateDeal(row.id) : duplicateContact(row.id)),
                  "Duplicado."
                ),
            } as MenuItem,
          ]
        : []),
      { kind: "separator" },
      ...specific,
      { kind: "separator" },
      {
        label: "Mover a la papelera",
        icon: "⌫",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `Mover "${title}" a la papelera`,
            confirmLabel: "Mover",
            danger: true,
          });
          if (ok) run(() => softDelete(entity, [row.id]), "Movido a la papelera.");
        },
      },
    ]);
  }

  function headerMenu(e: React.MouseEvent, field: FieldDef) {
    openMenu(e, [
      { kind: "label", label: field.label },
      {
        label: "Ordenar ascendente",
        icon: "▲",
        onSelect: () => patch({ s: encodeURIComponent(JSON.stringify([{ field: field.key, dir: "asc" }])) }),
      },
      {
        label: "Ordenar descendente",
        icon: "▼",
        onSelect: () => patch({ s: encodeURIComponent(JSON.stringify([{ field: field.key, dir: "desc" }])) }),
      },
      ...(field.groupable
        ? [
            { kind: "separator" as const },
            { label: `Agrupar por ${field.label}`, icon: "⊞", onSelect: () => patch({ group: field.key }) },
          ]
        : []),
      {
        label: "Filtrar por este campo",
        icon: "⚟",
        onSelect: () =>
          patch({
            f: encodeURIComponent(
              JSON.stringify([
                ...config.filters,
                { field: field.key, op: field.options ? "is" : "contains", value: "" },
              ])
            ),
          }),
      },
      { kind: "separator" },
      { label: "Ocultar campo", icon: "◌", onSelect: () => setFields(visibleKeys.filter((k) => k !== field.key)) },
    ]);
  }

  const bgMenu: MenuItem[] = [
    { kind: "label", label: `Vista de ${words.many}` },
    ...(canWrite
      ? ([
          {
            label: `Nuevo ${words.one}`,
            icon: "＋",
            onSelect: () => router.push(entity === "contacts" ? "/contacts/new" : `${detailPath}/new`),
          },
          ...(entity === "contacts"
            ? [{ label: "Importar CSV", icon: "↑", onSelect: () => fileRef.current?.click() } as MenuItem]
            : []),
          {
            label: "Guardar esta vista…",
            icon: "★",
            onSelect: async () => {
              const name = window.prompt("Nombre de la vista:");
              if (!name?.trim()) return;
              const cfg: Record<string, string> = {};
              params.forEach((v, k) => (cfg[k] = v));
              run(() => saveView(entity, name, cfg, true), "Vista guardada.");
            },
          },
        ] as MenuItem[])
      : []),
    { kind: "separator" },
    { label: "Exportar lo que se ve", icon: "↓", onSelect: () => exportRows(shown, `${entity}.csv`) },
    {
      label: "Seleccionar todo lo visible",
      icon: "☑",
      onSelect: () => setSelected(new Set(shown.map((r) => r.id))),
    },
    { label: "Restablecer vista", icon: "⟲", onSelect: () => router.push(pathname) },
  ];

  /* -------------------------------------------------------- render --- */

  const kanbanField =
    fields.find((f) => f.key === config.kanbanBy && f.groupable) ??
    fields.find((f) => f.groupable)!;
  const calendarField =
    fields.find((f) => f.key === config.calendarBy) ??
    fields.find((f) => f.type === "date" || f.type === "datetime")!;

  const pageCount = Math.max(1, Math.ceil(total / config.per));

  return (
    <div className="flex min-h-0 flex-1 flex-col" onContextMenu={(e) => openMenu(e, bgMenu)}>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />

      {views.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-hair px-4 py-2 lg:px-6">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-450">Vistas</span>
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() =>
                router.push(`${pathname}?${new URLSearchParams(v.config as Record<string, string>)}`)
              }
              onContextMenu={(e) =>
                openMenu(e, [
                  { kind: "label", label: v.name },
                  {
                    label: "Eliminar vista",
                    icon: "✕",
                    danger: true,
                    disabled: v.user_id !== currentUserId,
                    onSelect: () => run(() => deleteView(v.id), "Vista eliminada."),
                  },
                ])
              }
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-2.5 py-[3px] text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
            >
              ★ {v.name}
            </button>
          ))}
        </div>
      )}

      <ViewToolbar
        config={config}
        fields={fields}
        visibleKeys={visibleKeys}
        onPatch={patch}
        onSetFields={setFields}
        rowCount={shown.length}
        total={total}
      />

      {selected.size > 0 && canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-4 py-2 lg:px-6">
          <span className="text-[12px] font-semibold text-gold">{selected.size} seleccionados</span>
          <button
            onClick={(e) => openMenu(e, bulkItems())}
            className="rounded-full border border-[rgba(245,245,245,0.12)] px-2.5 py-[2px] text-[11px] text-ink-150 hover:border-gold hover:text-gold"
          >
            Acciones en lote ▾
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11px] text-ink-350 hover:text-ink-50"
          >
            Deseleccionar
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Mover ${selected.size} a la papelera`,
                confirmLabel: "Mover",
                danger: true,
              });
              if (ok) run(() => softDelete(entity, ids), "Movidos a la papelera.");
            }}
            className="rounded-full bg-[#FF8F7A] px-3 py-[2px] text-[11px] font-semibold text-ink-950"
          >
            Papelera
          </button>
        </div>
      )}

      {config.view === "grid" && (
        <DataGrid
          rows={shown}
          fields={visibleFields}
          config={config}
          allTags={tags}
          selected={selected}
          canWrite={canWrite}
          onToggleRow={toggleRow}
          onToggleAll={() =>
            setSelected((prev) =>
              prev.size === shown.length ? new Set() : new Set(shown.map((r) => r.id))
            )
          }
          onEdit={edit}
          onOpen={setOpenRow}
          onRowMenu={rowMenu}
          onHeaderMenu={headerMenu}
          onResize={setWidth}
          onQuickCreate={(name) =>
            start(async () => {
              const res =
                entity === "contacts"
                  ? await quickCreateContact(name)
                  : await quickCreateRecord(entity, name);
              if (res?.error) toast(res.error, "error");
              else {
                toast(`${words.one[0].toUpperCase()}${words.one.slice(1)} creado.`);
                router.refresh();
              }
            })
          }
        />
      )}

      {config.view === "kanban" && (
        <KanbanView
          rows={shown}
          fields={visibleFields}
          groupField={kanbanField}
          canWrite={canWrite}
          onEdit={(id, key, value) => edit(id, key, value)}
          onOpen={setOpenRow}
          onRowMenu={rowMenu}
        />
      )}

      {config.view === "calendar" && (
        <CalendarView rows={shown} dateField={calendarField} onOpen={setOpenRow} onRowMenu={rowMenu} />
      )}

      {config.view === "gallery" && (
        <GalleryView rows={shown} fields={visibleFields} onOpen={setOpenRow} onRowMenu={rowMenu} />
      )}

      {config.view === "grid" && !config.groupBy && total > config.per && (
        <div className="flex items-center gap-3 border-t border-hair px-4 py-2 text-[12px] text-ink-400 lg:px-6">
          <select
            value={config.per}
            onChange={(e) => patch({ per: e.target.value, page: null })}
            className="rounded-[7px] border border-[rgba(245,245,245,0.1)] bg-transparent px-2 py-1 text-[11.5px] outline-none"
          >
            {[25, 50, 100, 250].map((n) => (
              <option key={n} value={n}>
                {n} filas
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            disabled={config.page === 0}
            onClick={() => patch({ page: String(config.page - 1) })}
            className="rounded-[7px] border border-[rgba(245,245,245,0.1)] px-2 py-1 disabled:opacity-30"
          >
            ‹
          </button>
          <span className="tnum">
            {config.page + 1} / {pageCount}
          </span>
          <button
            disabled={config.page >= pageCount - 1}
            onClick={() => patch({ page: String(config.page + 1) })}
            className="rounded-[7px] border border-[rgba(245,245,245,0.1)] px-2 py-1 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}

      {openRow && (
        <RecordPanel
          row={shown.find((r) => r.id === openRow.id) ?? openRow}
          fields={fields}
          allTags={tags}
          canWrite={canWrite}
          members={members}
          onEdit={edit}
          onClose={() => setOpenRow(null)}
          detailPath={detailPath}
        />
      )}
    </div>
  );
}
