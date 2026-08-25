"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import Tag from "@/components/Tag";
import {
  bulkAssignContacts,
  bulkSetContactCompany,
  bulkSetContactStatus,
  bulkTagContacts,
  deleteContact,
  duplicateContact,
  importContacts,
  mergeContacts,
  saveView,
  softDelete,
  deleteView,
} from "@/app/actions";
import { CONTACT_STATUSES, GOLD, STATUS, type ContactStatus } from "@/lib/constants";
import { eur, initials, relative } from "@/lib/format";
import { downloadCsv, mapContactRow, parseCsv, toCsv } from "@/lib/csv";
import { memberName } from "@/lib/workspace-client";
import type { Company, Membership, SavedView } from "@/lib/types";

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: ContactStatus;
  company_id: string | null;
  company_name: string | null;
  assigned_to: string | null;
  tags: string[];
  open_value: number;
  open_deals: number;
  open_tasks: number;
  last_activity: string;
  created_at: string;
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "Contacto" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Estado" },
  { key: "value", label: "Valor" },
  { key: "deals", label: "Deals" },
  { key: "last", label: "Actividad" },
];

const GRID = "34px 2fr 1.4fr 0.9fr 0.9fr 0.55fr 0.9fr 34px";

export default function ContactsTable({
  rows,
  total,
  page,
  per,
  statusCounts,
  companies,
  allTags,
  members,
  views,
  canWrite,
  currentUserId,
}: {
  rows: ContactRow[];
  total: number;
  page: number;
  per: number;
  statusCounts: Record<string, number>;
  companies: Pick<Company, "id" | "name">[];
  allTags: string[];
  members: Membership[];
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [term, setTerm] = useState(params.get("q") ?? "");
  const lastIndex = useRef<number | null>(null);

  const get = (k: string, d = "all") => params.get(k) ?? d;

  /** Navegación por URL: el servidor filtra, ordena y pagina. */
  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    });
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  function toggleSort(key: string) {
    const cur = get("sort", "value");
    const dir = get("dir", "desc");
    setParams({ sort: key, dir: cur === key && dir === "desc" ? "asc" : "desc" });
  }

  const pageCount = Math.max(1, Math.ceil(total / per));
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = Array.from(selected);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  function run(fn: () => Promise<{ error?: string } | void>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(okMsg);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function toggleOne(id: string, index: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex.current !== null) {
        const [from, to] = [lastIndex.current, index].sort((a, b) => a - b);
        for (let i = from; i <= to; i++) next.add(rows[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIndex.current = index;
  }

  function exportRows(list: ContactRow[], filename: string) {
    if (!list.length) return toast("No hay filas que exportar.", "error");
    downloadCsv(
      filename,
      toCsv(
        list.map((r) => ({
          nombre: r.name,
          email: r.email ?? "",
          telefono: r.phone ?? "",
          cargo: r.role ?? "",
          empresa: r.company_name ?? "",
          estado: r.status,
          etiquetas: (r.tags ?? []).join("; "),
          responsable: memberName(members, r.assigned_to),
          valor_abierto: r.open_value,
          deals_abiertos: r.open_deals,
          ultima_actividad: r.last_activity,
        }))
      )
    );
    toast(`${list.length} contactos exportados.`);
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text).map(mapContactRow).filter((r) => r.name);
    if (!parsed.length) {
      toast("No se encontró ninguna fila con columna de nombre.", "error");
      return;
    }
    const ok = await confirm({
      title: `Importar ${parsed.length} contactos`,
      message:
        "Se crearán las empresas que no existan. Las filas sin nombre se descartan. Después puedes buscar duplicados desde el menú.",
      confirmLabel: "Importar",
    });
    if (!ok) return;
    run(() => importContacts(parsed), `${parsed.length} contactos importados.`);
  }

  /** Duplicados sobre la página actual: mismo email, o mismo nombre normalizado. */
  const duplicates = useMemo(() => {
    const byKey = new Map<string, ContactRow[]>();
    rows.forEach((r) => {
      const keys = [
        r.email ? `e:${r.email.toLowerCase().trim()}` : null,
        `n:${r.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()}`,
      ].filter(Boolean) as string[];
      keys.forEach((k) => {
        const list = byKey.get(k) ?? [];
        list.push(r);
        byKey.set(k, list);
      });
    });
    const groups: ContactRow[][] = [];
    const seen = new Set<string>();
    byKey.forEach((list) => {
      if (list.length < 2) return;
      const sig = list
        .map((r) => r.id)
        .sort()
        .join("|");
      if (seen.has(sig)) return;
      seen.add(sig);
      groups.push(list);
    });
    return groups;
  }, [rows]);

  async function reviewDuplicates() {
    if (!duplicates.length) {
      toast("No hay duplicados en esta página.");
      return;
    }
    const group = duplicates[0];
    const keep = group[0];
    const ok = await confirm({
      title: `Fusionar ${group.length} duplicados`,
      message: `Se conservará "${keep.name}" (${keep.email || "sin email"}) y el resto pasará a la papelera. Sus deals, actividades y adjuntos se mueven al superviviente.`,
      confirmLabel: "Fusionar",
    });
    if (!ok) return;
    run(
      () => mergeContacts(keep.id, group.slice(1).map((g) => g.id)),
      `${group.length - 1} duplicados fusionados.`
    );
  }

  /* ------------------------------------------------- menú de clic derecho */

  function rowMenu(row: ContactRow): MenuItem[] {
    const multi = selected.size > 1 && selected.has(row.id);

    const view: MenuItem[] = [
      { kind: "label", label: multi ? `${selected.size} seleccionados` : row.name },
      { label: "Abrir ficha", icon: "↗", onSelect: () => router.push(`/contacts/${row.id}`) },
      {
        label: "Abrir en pestaña nueva",
        icon: "⧉",
        onSelect: () => window.open(`/contacts/${row.id}`, "_blank"),
      },
    ];

    if (!canWrite) return view;

    if (multi) {
      return [
        { kind: "label", label: `${selected.size} contactos seleccionados` },
        ...CONTACT_STATUSES.map((s) => ({
          label: `Marcar como ${STATUS[s].label}`,
          icon: "◦",
          onSelect: () => run(() => bulkSetContactStatus(ids, s), "Estado actualizado."),
        })),
        { kind: "separator" },
        { kind: "label", label: "Asignar a" },
        ...members.map((m) => ({
          label: m.profile?.full_name || m.profile?.email || "Miembro",
          icon: "◍",
          onSelect: () => run(() => bulkAssignContacts(ids, m.user_id), "Asignados."),
        })),
        {
          label: "Sin asignar",
          icon: "—",
          onSelect: () => run(() => bulkAssignContacts(ids, null), "Sin responsable."),
        },
        { kind: "separator" },
        {
          label: "Añadir etiqueta…",
          icon: "⌗",
          onSelect: async () => {
            const t = window.prompt("Etiqueta a añadir a los seleccionados:");
            if (t?.trim()) run(() => bulkTagContacts(ids, t.trim()), "Etiqueta añadida.");
          },
        },
        {
          label: "Quitar de la empresa",
          icon: "▤",
          onSelect: () => run(() => bulkSetContactCompany(ids, null), "Empresa desasignada."),
        },
        {
          label: "Exportar selección",
          icon: "↓",
          onSelect: () => exportRows(selectedRows, "contactos-seleccion.csv"),
        },
        {
          label: `Fusionar los ${selected.size} en el primero`,
          icon: "⇉",
          disabled: selected.size < 2,
          onSelect: async () => {
            const keep = selectedRows[0];
            const ok = await confirm({
              title: `Fusionar en "${keep.name}"`,
              message:
                "El resto pasará a la papelera y sus deals, actividades y adjuntos se moverán al superviviente.",
              confirmLabel: "Fusionar",
            });
            if (ok)
              run(
                () => mergeContacts(keep.id, ids.filter((i) => i !== keep.id)),
                "Duplicados fusionados."
              );
          },
        },
        { kind: "separator" },
        {
          label: `Mover ${selected.size} a la papelera`,
          icon: "⌫",
          danger: true,
          onSelect: async () => {
            const ok = await confirm({
              title: `Mover ${selected.size} contactos a la papelera`,
              message: "Podrás restaurarlos desde Papelera. Nada se borra de forma definitiva.",
              confirmLabel: "Mover a papelera",
              danger: true,
            });
            if (ok) run(() => softDelete("contacts", ids), `${ids.length} en la papelera.`);
          },
        },
      ];
    }

    return [
      ...view,
      { label: "Editar", icon: "✎", onSelect: () => router.push(`/contacts/${row.id}?edit=1`) },
      {
        label: "Duplicar",
        icon: "⧉",
        onSelect: () => run(() => duplicateContact(row.id), "Contacto duplicado."),
      },
      { kind: "separator" },
      {
        label: "Enviar email",
        icon: "✉",
        disabled: !row.email,
        onSelect: () => (window.location.href = `mailto:${row.email}`),
      },
      {
        label: "Copiar email",
        icon: "⧉",
        disabled: !row.email,
        onSelect: () => {
          navigator.clipboard.writeText(row.email!);
          toast("Email copiado.");
        },
      },
      {
        label: "Copiar teléfono",
        icon: "⧉",
        disabled: !row.phone,
        onSelect: () => {
          navigator.clipboard.writeText(row.phone!);
          toast("Teléfono copiado.");
        },
      },
      { kind: "separator" },
      {
        label: "Crear deal para este contacto",
        icon: "＋",
        onSelect: () => router.push(`/deals/new?contact=${row.id}`),
      },
      {
        label: "Añadir tarea",
        icon: "✓",
        onSelect: () => router.push(`/contacts/${row.id}?task=1`),
      },
      { kind: "separator" },
      { kind: "label", label: "Cambiar estado" },
      ...CONTACT_STATUSES.map((s) => ({
        label: STATUS[s].label,
        icon: row.status === s ? "●" : "○",
        disabled: row.status === s,
        onSelect: () => run(() => bulkSetContactStatus([row.id], s), "Estado actualizado."),
      })),
      { kind: "separator" },
      { kind: "label", label: "Asignar a" },
      ...members.map((m) => ({
        label: m.profile?.full_name || m.profile?.email || "Miembro",
        icon: row.assigned_to === m.user_id ? "●" : "○",
        onSelect: () => run(() => bulkAssignContacts([row.id], m.user_id), "Asignado."),
      })),
      { kind: "separator" },
      {
        label: "Mover a la papelera",
        icon: "⌫",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `Mover a ${row.name} a la papelera`,
            message:
              "Podrás restaurarlo desde Papelera. Sus actividades se conservan mientras tanto.",
            confirmLabel: "Mover a papelera",
            danger: true,
          });
          if (ok) run(() => deleteContact(row.id), "Movido a la papelera.");
        },
      },
    ];
  }

  const bgMenu: MenuItem[] = [
    { kind: "label", label: "Contactos" },
    ...(canWrite
      ? ([
          { label: "Nuevo contacto", icon: "＋", onSelect: () => router.push("/contacts/new") },
          { label: "Importar CSV", icon: "↑", onSelect: () => fileRef.current?.click() },
          {
            label: duplicates.length
              ? `Revisar ${duplicates.length} posibles duplicados`
              : "Buscar duplicados",
            icon: "⇉",
            onSelect: reviewDuplicates,
          },
          {
            label: "Guardar esta vista…",
            icon: "★",
            onSelect: async () => {
              const name = window.prompt("Nombre de la vista:");
              if (!name?.trim()) return;
              const config: Record<string, string> = {};
              params.forEach((v, k) => (config[k] = v));
              run(() => saveView("contacts", name, config, true), "Vista guardada.");
            },
          },
        ] as MenuItem[])
      : []),
    { kind: "separator" },
    { label: "Exportar vista actual", icon: "↓", onSelect: () => exportRows(rows, "contactos.csv") },
    {
      label: "Seleccionar todo lo visible",
      icon: "☑",
      onSelect: () => setSelected(new Set(rows.map((r) => r.id))),
    },
    { label: "Limpiar filtros", icon: "⟲", onSelect: () => router.push(pathname) },
  ];

  /* --------------------------------------------------------------- render */

  return (
    <div onContextMenu={(e) => openMenu(e, bgMenu)}>
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

      {/* vistas guardadas */}
      {views.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink-450">Vistas</span>
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                const p = new URLSearchParams(v.config as Record<string, string>);
                router.push(`${pathname}?${p.toString()}`);
              }}
              onContextMenu={(e) =>
                openMenu(e, [
                  { kind: "label", label: v.name },
                  { label: "Aplicar", icon: "↗", onSelect: () => router.push(`${pathname}?${new URLSearchParams(v.config as Record<string, string>).toString()}`) },
                  {
                    label: "Eliminar vista",
                    icon: "✕",
                    danger: true,
                    disabled: v.user_id !== currentUserId,
                    onSelect: () => run(() => deleteView(v.id), "Vista eliminada."),
                  },
                ])
              }
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
            >
              ★ {v.name}
            </button>
          ))}
        </div>
      )}

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2.5">
        {(
          [
            ["all", "Todos"],
            ["lead", "Leads"],
            ["prospect", "Prospects"],
            ["customer", "Customers"],
          ] as const
        ).map(([key, label]) => {
          const active = get("status") === key;
          return (
            <button
              key={key}
              onClick={() => setParams({ status: key })}
              className="rounded-full px-[15px] py-2 text-[12.5px] font-medium transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {label} <span className="tnum ml-[3px] opacity-65">{statusCounts[key] ?? 0}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: term });
          }}
          className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-3 py-2"
        >
          <span className="text-[12px] text-ink-450">⌕</span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => setParams({ q: term })}
            placeholder="Buscar en la tabla…"
            className="w-[170px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
          />
        </form>

        <select
          value={get("company")}
          onChange={(e) => setParams({ company: e.target.value })}
          className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
        >
          <option value="all">Todas las empresas</option>
          <option value="none">Sin empresa</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={get("assigned")}
          onChange={(e) => setParams({ assigned: e.target.value })}
          className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
        >
          <option value="all">Todo el equipo</option>
          <option value="none">Sin asignar</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.full_name || m.profile?.email || "Miembro"}
            </option>
          ))}
        </select>

        {allTags.length > 0 && (
          <select
            value={get("tag")}
            onChange={(e) => setParams({ tag: e.target.value })}
            className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
          >
            <option value="all">Todas las etiquetas</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {canWrite && (
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-2 text-[12.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
          >
            Importar
          </button>
        )}
        <button
          onClick={() => exportRows(rows, "contactos.csv")}
          className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-2 text-[12.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        >
          Exportar
        </button>
      </div>

      {duplicates.length > 0 && canWrite && (
        <button
          onClick={reviewDuplicates}
          className="mt-3 w-full rounded-[11px] border border-[rgba(250,197,28,0.28)] bg-[rgba(250,197,28,0.05)] px-4 py-2.5 text-left text-[12.5px] text-gold"
        >
          ⇉ {duplicates.length} posible{duplicates.length > 1 ? "s" : ""} duplicado
          {duplicates.length > 1 ? "s" : ""} en esta página — pulsa para revisarlos
        </button>
      )}

      {/* acciones en lote */}
      {selected.size > 0 && canWrite && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[11px] border border-[rgba(250,197,28,0.3)] bg-[rgba(250,197,28,0.06)] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-gold">
            {selected.size} seleccionados
          </span>
          <span className="text-ink-500">·</span>
          {CONTACT_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => run(() => bulkSetContactStatus(ids, s), "Estado actualizado.")}
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
            >
              → {STATUS[s].label}
            </button>
          ))}
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.value = "";
              if (v)
                run(
                  () => bulkAssignContacts(ids, v === "none" ? null : v),
                  "Responsable actualizado."
                );
            }}
            className="rounded-full border border-[rgba(245,245,245,0.12)] bg-transparent px-3 py-1 text-[11.5px] text-ink-150 outline-none"
          >
            <option value="">Asignar a…</option>
            <option value="none">Sin asignar</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile?.full_name || m.profile?.email}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.value = "";
              if (v)
                run(
                  () => bulkSetContactCompany(ids, v === "none" ? null : v),
                  "Empresa asignada."
                );
            }}
            className="rounded-full border border-[rgba(245,245,245,0.12)] bg-transparent px-3 py-1 text-[11.5px] text-ink-150 outline-none"
          >
            <option value="">Empresa…</option>
            <option value="none">Sin empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              const t = window.prompt("Etiqueta a añadir:");
              if (t?.trim()) run(() => bulkTagContacts(ids, t.trim()), "Etiqueta añadida.");
            }}
            className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
          >
            + Etiqueta
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11.5px] text-ink-350 transition-colors hover:text-ink-50"
          >
            Deseleccionar
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Mover ${selected.size} contactos a la papelera`,
                message: "Podrás restaurarlos desde Papelera.",
                confirmLabel: "Mover a papelera",
                danger: true,
              });
              if (ok) run(() => softDelete("contacts", ids), `${ids.length} en la papelera.`);
            }}
            className="rounded-full bg-[#FF8F7A] px-3.5 py-1 text-[11.5px] font-semibold text-ink-950"
          >
            Papelera
          </button>
        </div>
      )}

      {/* tabla */}
      <div className="panel mt-[14px] overflow-x-auto">
        <div className="min-w-[880px]">
          <div
            className="grid items-center border-b border-hair bg-ink-915 px-5"
            style={{ gridTemplateColumns: GRID }}
          >
            <label className="flex cursor-pointer items-center py-3.5">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (allVisibleSelected) rows.forEach((r) => next.delete(r.id));
                    else rows.forEach((r) => next.add(r.id));
                    return next;
                  })
                }
                className="h-[13px] w-[13px] accent-[#FAC51C]"
              />
            </label>
            {COLUMNS.map((col) => {
              const active = get("sort", "value") === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="flex items-center gap-1.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors hover:text-gold"
                  style={{ color: active ? GOLD : "#7A7A7A" }}
                >
                  <span>{col.label}</span>
                  <span className="text-[9px] text-gold">
                    {active ? (get("dir", "desc") === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              );
            })}
            <span />
          </div>

          {rows.length === 0 && (
            <div className="px-5 py-12 text-center text-[12.5px] text-ink-400">
              No hay contactos que coincidan.{" "}
              <button onClick={() => router.push(pathname)} className="text-gold">
                Limpiar filtros
              </button>
            </div>
          )}

          {rows.map((row, i) => {
            const b = STATUS[row.status] ?? STATUS.lead;
            const isSel = selected.has(row.id);
            return (
              <div
                key={row.id}
                onContextMenu={(e) => openMenu(e, rowMenu(row))}
                onClick={() => router.push(`/contacts/${row.id}`)}
                className="grid cursor-pointer items-center border-b border-[rgba(245,245,245,0.05)] px-5 py-[11px] transition-colors hover:bg-ink-860"
                style={{
                  gridTemplateColumns: GRID,
                  background: isSel ? "rgba(250,197,28,0.06)" : undefined,
                }}
              >
                <label
                  className="flex cursor-pointer items-center py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={(e) =>
                      toggleOne(row.id, i, (e.nativeEvent as MouseEvent).shiftKey === true)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="h-[13px] w-[13px] accent-[#FAC51C]"
                  />
                </label>

                <div className="flex min-w-0 items-center gap-3 pr-3">
                  <div
                    className="grid h-8 w-8 flex-[0_0_32px] place-items-center rounded-full border border-[rgba(245,245,245,0.08)] bg-ink-800 text-[11.5px] font-semibold text-ink-150"
                    title={memberName(members, row.assigned_to)}
                  >
                    {initials(row.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-medium">{row.name}</span>
                      {row.open_tasks > 0 && (
                        <span
                          title={`${row.open_tasks} tareas pendientes`}
                          className="tnum rounded-full bg-[rgba(250,197,28,0.14)] px-1.5 text-[10px] font-semibold text-gold"
                        >
                          {row.open_tasks}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-400">
                      {row.email || row.role || "—"}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 pr-3">
                  <div className="truncate text-[13px] text-ink-150">
                    {row.company_name || "—"}
                  </div>
                  {(row.tags ?? []).length > 0 && (
                    <div className="mt-1 flex gap-1 overflow-hidden">
                      {(row.tags ?? []).slice(0, 2).map((t) => (
                        <Tag key={t} tag={t} small />
                      ))}
                      {(row.tags ?? []).length > 2 && (
                        <span className="text-[10px] text-ink-450">
                          +{(row.tags ?? []).length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <span
                    className="inline-block rounded-full px-[11px] py-1 text-[11px] font-semibold"
                    style={{ background: b.bg, color: b.fg, border: `1px solid ${b.border}` }}
                  >
                    {b.label}
                  </span>
                </div>

                <div className="tnum text-[13px] font-medium">{eur(Number(row.open_value))}</div>
                <div className="tnum text-[12.5px] text-ink-300">{row.open_deals}</div>
                <div className="text-[12.5px] text-ink-350">{relative(row.last_activity)}</div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(e, rowMenu(row));
                  }}
                  title="Acciones"
                  className="text-right text-[15px] text-ink-500 transition-colors hover:text-gold"
                >
                  ⋯
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* paginación */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[12px] text-ink-400">
        <span>{total} resultados</span>
        <div className="flex-1" />
        <select
          value={per}
          onChange={(e) => setParams({ per: e.target.value, page: "0" })}
          className="rounded-[8px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2 py-1 text-[12px] text-ink-150 outline-none"
        >
          {[25, 50, 100, 250].map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>
        <button
          disabled={page === 0}
          onClick={() => setParams({ page: String(page - 1) })}
          className="rounded-[8px] border border-[rgba(245,245,245,0.1)] px-2.5 py-1 transition-colors hover:text-gold disabled:opacity-30"
        >
          ‹
        </button>
        <span className="tnum">
          {page + 1} / {pageCount}
        </span>
        <button
          disabled={page >= pageCount - 1}
          onClick={() => setParams({ page: String(page + 1) })}
          className="rounded-[8px] border border-[rgba(245,245,245,0.1)] px-2.5 py-1 transition-colors hover:text-gold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mt-2 text-[11.5px] text-ink-500">
        Clic derecho para el menú de acciones · Mayús+clic en las casillas para seleccionar un
        rango · el filtrado y la paginación se hacen en la base de datos
      </div>
    </div>
  );
}
