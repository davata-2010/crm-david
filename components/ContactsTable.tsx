"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import Tag from "@/components/Tag";
import {
  bulkDeleteContacts,
  bulkSetContactCompany,
  bulkSetContactStatus,
  bulkTagContacts,
  deleteContact,
  duplicateContact,
  importContacts,
} from "@/app/actions";
import { CONTACT_STATUSES, GOLD, STATUS, type ContactStatus } from "@/lib/constants";
import { eur, initials, relative } from "@/lib/format";
import { downloadCsv, mapContactRow, parseCsv, toCsv } from "@/lib/csv";
import type { Company, Contact } from "@/lib/types";

export type ContactRow = {
  contact: Contact;
  value: number;
  openDeals: number;
  lastIso: string;
  taskCount: number;
};

type SortKey = "name" | "company" | "status" | "value" | "last" | "deals";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Contacto" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Estado" },
  { key: "value", label: "Valor" },
  { key: "deals", label: "Deals" },
  { key: "last", label: "Última actividad" },
];

const GRID = "34px 2fr 1.4fr 0.9fr 0.9fr 0.6fr 1fr 34px";

export default function ContactsTable({
  rows,
  companies,
  allTags,
}: {
  rows: ContactRow[];
  companies: Pick<Company, "id" | "name">[];
  allTags: string[];
}) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ContactStatus>("all");
  const [companyId, setCompanyId] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const lastIndex = useRef<number | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      lead: rows.filter((r) => r.contact.status === "lead").length,
      prospect: rows.filter((r) => r.contact.status === "prospect").length,
      customer: rows.filter((r) => r.contact.status === "customer").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = rows.filter(({ contact: c }) => {
      if (status !== "all" && c.status !== status) return false;
      if (companyId !== "all" && (c.company_id ?? "none") !== companyId) return false;
      if (tag !== "all" && !(c.tags ?? []).includes(tag)) return false;
      if (!term) return true;
      return `${c.name} ${c.email ?? ""} ${c.company?.name ?? ""} ${c.role ?? ""} ${(
        c.tags ?? []
      ).join(" ")}`
        .toLowerCase()
        .includes(term);
    });

    const mul = dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      switch (sort) {
        case "value":
          return (a.value - b.value) * mul;
        case "deals":
          return (a.openDeals - b.openDeals) * mul;
        case "company":
          return (a.contact.company?.name ?? "").localeCompare(b.contact.company?.name ?? "") * mul;
        case "status":
          return a.contact.status.localeCompare(b.contact.status) * mul;
        case "last":
          return (+new Date(a.lastIso) - +new Date(b.lastIso)) * mul;
        default:
          return a.contact.name.localeCompare(b.contact.name) * mul;
      }
    });
  }, [rows, q, status, companyId, tag, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * perPage, current * perPage + perPage);

  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.contact.id));

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setDir("desc");
    }
  }

  function toggleOne(id: string, index: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex.current !== null) {
        const [from, to] = [lastIndex.current, index].sort((a, b) => a - b);
        for (let i = from; i <= to; i++) next.add(visible[i].contact.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIndex.current = index;
  }

  const selectedRows = rows.filter((r) => selected.has(r.contact.id));
  const ids = selectedRows.map((r) => r.contact.id);

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

  function exportRows(list: ContactRow[], filename: string) {
    if (list.length === 0) return toast("No hay filas que exportar.", "error");
    downloadCsv(
      filename,
      toCsv(
        list.map((r) => ({
          nombre: r.contact.name,
          email: r.contact.email ?? "",
          telefono: r.contact.phone ?? "",
          cargo: r.contact.role ?? "",
          empresa: r.contact.company?.name ?? "",
          estado: r.contact.status,
          etiquetas: (r.contact.tags ?? []).join("; "),
          valor_abierto: r.value,
          deals_abiertos: r.openDeals,
          ultima_actividad: r.lastIso,
        })),
        [
          "nombre",
          "email",
          "telefono",
          "cargo",
          "empresa",
          "estado",
          "etiquetas",
          "valor_abierto",
          "deals_abiertos",
          "ultima_actividad",
        ]
      )
    );
    toast(`${list.length} contactos exportados.`);
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text).map(mapContactRow).filter((r) => r.name);
    if (parsed.length === 0) {
      toast("No se encontró ninguna fila con columna de nombre.", "error");
      return;
    }
    const ok = await confirm({
      title: `Importar ${parsed.length} contactos`,
      message:
        "Se crearán las empresas que no existan. Las filas sin nombre se descartan. Esta acción no sobrescribe contactos existentes.",
      confirmLabel: "Importar",
    });
    if (!ok) return;
    run(() => importContacts(parsed), `${parsed.length} contactos importados.`);
  }

  /* ------------------------------------------------- menú de clic derecho */

  function rowMenu(row: ContactRow): MenuItem[] {
    const c = row.contact;
    const multi = selected.size > 1 && selected.has(c.id);

    if (multi) {
      return [
        { kind: "label", label: `${selected.size} contactos seleccionados` },
        {
          label: "Marcar como Lead",
          icon: "◦",
          onSelect: () => run(() => bulkSetContactStatus(ids, "lead"), "Estado actualizado."),
        },
        {
          label: "Marcar como Prospect",
          icon: "◦",
          onSelect: () => run(() => bulkSetContactStatus(ids, "prospect"), "Estado actualizado."),
        },
        {
          label: "Marcar como Customer",
          icon: "◦",
          onSelect: () => run(() => bulkSetContactStatus(ids, "customer"), "Estado actualizado."),
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
        { kind: "separator" },
        {
          label: `Eliminar ${selected.size} contactos`,
          icon: "✕",
          danger: true,
          onSelect: async () => {
            const ok = await confirm({
              title: `Eliminar ${selected.size} contactos`,
              message:
                "Se borrarán también sus actividades. Los deals asociados se conservan sin contacto. No se puede deshacer.",
              confirmLabel: "Eliminar",
              danger: true,
            });
            if (ok) run(() => bulkDeleteContacts(ids), `${ids.length} contactos eliminados.`);
          },
        },
      ];
    }

    return [
      { kind: "label", label: c.name },
      { label: "Abrir ficha", icon: "↗", onSelect: () => router.push(`/contacts/${c.id}`) },
      {
        label: "Abrir en pestaña nueva",
        icon: "⧉",
        onSelect: () => window.open(`/contacts/${c.id}`, "_blank"),
      },
      { label: "Editar", icon: "✎", onSelect: () => router.push(`/contacts/${c.id}?edit=1`) },
      {
        label: "Duplicar",
        icon: "⧉",
        onSelect: () => run(() => duplicateContact(c.id), "Contacto duplicado."),
      },
      { kind: "separator" },
      {
        label: "Enviar email",
        icon: "✉",
        disabled: !c.email,
        onSelect: () => (window.location.href = `mailto:${c.email}`),
      },
      {
        label: "Copiar email",
        icon: "⧉",
        disabled: !c.email,
        onSelect: () => {
          navigator.clipboard.writeText(c.email!);
          toast("Email copiado.");
        },
      },
      {
        label: "Copiar teléfono",
        icon: "⧉",
        disabled: !c.phone,
        onSelect: () => {
          navigator.clipboard.writeText(c.phone!);
          toast("Teléfono copiado.");
        },
      },
      { kind: "separator" },
      {
        label: "Crear deal para este contacto",
        icon: "＋",
        onSelect: () => router.push(`/deals/new?contact=${c.id}`),
      },
      {
        label: "Añadir tarea",
        icon: "✓",
        onSelect: () => router.push(`/contacts/${c.id}?task=1`),
      },
      { kind: "separator" },
      { kind: "label", label: "Cambiar estado" },
      ...CONTACT_STATUSES.map((s) => ({
        label: STATUS[s].label,
        icon: c.status === s ? "●" : "○",
        onSelect: () => run(() => bulkSetContactStatus([c.id], s), "Estado actualizado."),
      })),
      { kind: "separator" },
      {
        label: "Eliminar contacto",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `Eliminar a ${c.name}`,
            message:
              "Se borrarán también todas sus actividades. Los deals asociados se conservan sin contacto. No se puede deshacer.",
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteContact(c.id), "Contacto eliminado.");
        },
      },
    ];
  }

  const emptyMenu: MenuItem[] = [
    { kind: "label", label: "Contactos" },
    { label: "Nuevo contacto", icon: "＋", onSelect: () => router.push("/contacts/new") },
    { label: "Importar CSV", icon: "↑", onSelect: () => fileRef.current?.click() },
    {
      label: "Exportar todo",
      icon: "↓",
      onSelect: () => exportRows(rows, "contactos.csv"),
    },
    {
      label: "Exportar vista filtrada",
      icon: "↓",
      onSelect: () => exportRows(filtered, "contactos-filtrados.csv"),
    },
    { kind: "separator" },
    {
      label: "Seleccionar todo",
      icon: "☑",
      onSelect: () => setSelected(new Set(filtered.map((r) => r.contact.id))),
    },
    { label: "Limpiar filtros", icon: "⟲", onSelect: resetFilters },
  ];

  function resetFilters() {
    setQ("");
    setStatus("all");
    setCompanyId("all");
    setTag("all");
    setPage(0);
  }

  /* ------------------------------------------------------------- render */

  return (
    <div onContextMenu={(e) => openMenu(e, emptyMenu)}>
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

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2.5">
        {(
          [
            ["all", "Todos", counts.all],
            ["lead", "Leads", counts.lead],
            ["prospect", "Prospects", counts.prospect],
            ["customer", "Customers", counts.customer],
          ] as const
        ).map(([key, label, count]) => {
          const active = status === key;
          return (
            <button
              key={key}
              onClick={() => {
                setStatus(key as "all" | ContactStatus);
                setPage(0);
              }}
              className="rounded-full px-[15px] py-2 text-[12.5px] font-medium transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {label} <span className="tnum ml-[3px] opacity-65">{count}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-3 py-2">
          <span className="text-[12px] text-ink-450">⌕</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Filtrar la tabla…"
            className="w-[170px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
          />
        </div>

        <select
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setPage(0);
          }}
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

        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(0);
            }}
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

        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-2 text-[12.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        >
          Importar
        </button>
        <button
          onClick={() => exportRows(filtered, "contactos.csv")}
          className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-2 text-[12.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        >
          Exportar
        </button>
      </div>

      {/* barra de acciones en lote */}
      {selected.size > 0 && (
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
              if (v) run(() => bulkSetContactCompany(ids, v === "none" ? null : v), "Empresa asignada.");
            }}
            className="rounded-full border border-[rgba(245,245,245,0.12)] bg-transparent px-3 py-1 text-[11.5px] text-ink-150 outline-none"
          >
            <option value="">Asignar empresa…</option>
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
          <button
            onClick={() => exportRows(selectedRows, "contactos-seleccion.csv")}
            className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
          >
            Exportar
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
                title: `Eliminar ${selected.size} contactos`,
                message:
                  "Se borrarán también sus actividades. Los deals asociados se conservan sin contacto. No se puede deshacer.",
                confirmLabel: "Eliminar",
                danger: true,
              });
              if (ok) run(() => bulkDeleteContacts(ids), `${ids.length} contactos eliminados.`);
            }}
            className="rounded-full bg-[#FF8F7A] px-3.5 py-1 text-[11.5px] font-semibold text-ink-950"
          >
            Eliminar
          </button>
        </div>
      )}

      {/* tabla */}
      <div className="panel mt-[14px] overflow-hidden">
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
                  if (allVisibleSelected) visible.forEach((r) => next.delete(r.contact.id));
                  else visible.forEach((r) => next.add(r.contact.id));
                  return next;
                })
              }
              className="h-[13px] w-[13px] accent-[#FAC51C]"
            />
          </label>
          {COLUMNS.map((col) => {
            const active = sort === col.key;
            return (
              <button
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="flex items-center gap-1.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors hover:text-gold"
                style={{ color: active ? GOLD : "#7A7A7A" }}
              >
                <span>{col.label}</span>
                <span className="text-[9px] text-gold">
                  {active ? (dir === "asc" ? "▲" : "▼") : ""}
                </span>
              </button>
            );
          })}
          <span />
        </div>

        {visible.length === 0 && (
          <div className="px-5 py-12 text-center text-[12.5px] text-ink-400">
            No hay contactos que coincidan.{" "}
            <button onClick={resetFilters} className="text-gold">
              Limpiar filtros
            </button>
          </div>
        )}

        {visible.map((row, i) => {
          const c = row.contact;
          const b = STATUS[c.status] ?? STATUS.lead;
          const isSel = selected.has(c.id);
          return (
            <div
              key={c.id}
              onContextMenu={(e) => openMenu(e, rowMenu(row))}
              onClick={() => router.push(`/contacts/${c.id}`)}
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
                    toggleOne(c.id, i, (e.nativeEvent as MouseEvent).shiftKey === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="h-[13px] w-[13px] accent-[#FAC51C]"
                />
              </label>

              <div className="flex min-w-0 items-center gap-3 pr-3">
                <div className="grid h-8 w-8 flex-[0_0_32px] place-items-center rounded-full border border-[rgba(245,245,245,0.08)] bg-ink-800 text-[11.5px] font-semibold text-ink-150">
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium">{c.name}</span>
                    {row.taskCount > 0 && (
                      <span
                        title={`${row.taskCount} tareas pendientes`}
                        className="tnum rounded-full bg-[rgba(250,197,28,0.14)] px-1.5 text-[10px] font-semibold text-gold"
                      >
                        {row.taskCount}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-400">
                    {c.email || c.role || "—"}
                  </div>
                </div>
              </div>

              <div className="min-w-0 pr-3">
                <div className="truncate text-[13px] text-ink-150">
                  {c.company?.name || "—"}
                </div>
                {(c.tags ?? []).length > 0 && (
                  <div className="mt-1 flex gap-1 overflow-hidden">
                    {(c.tags ?? []).slice(0, 2).map((t) => (
                      <Tag key={t} tag={t} small />
                    ))}
                    {(c.tags ?? []).length > 2 && (
                      <span className="text-[10px] text-ink-450">
                        +{(c.tags ?? []).length - 2}
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

              <div className="tnum text-[13px] font-medium">{eur(row.value)}</div>
              <div className="tnum text-[12.5px] text-ink-300">{row.openDeals}</div>
              <div className="text-[12.5px] text-ink-350">{relative(row.lastIso)}</div>

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

      {/* paginación */}
      <div className="mt-3.5 flex items-center gap-3 text-[12px] text-ink-400">
        <span>
          {filtered.length} resultados
          {filtered.length !== rows.length && ` de ${rows.length}`}
        </span>
        <div className="flex-1" />
        <select
          value={perPage}
          onChange={(e) => {
            setPerPage(Number(e.target.value));
            setPage(0);
          }}
          className="rounded-[8px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2 py-1 text-[12px] text-ink-150 outline-none"
        >
          {[25, 50, 100, 250].map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>
        <button
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
          className="rounded-[8px] border border-[rgba(245,245,245,0.1)] px-2.5 py-1 transition-colors hover:text-gold disabled:opacity-30"
        >
          ‹
        </button>
        <span className="tnum">
          {current + 1} / {pageCount}
        </span>
        <button
          disabled={current >= pageCount - 1}
          onClick={() => setPage(current + 1)}
          className="rounded-[8px] border border-[rgba(245,245,245,0.1)] px-2.5 py-1 transition-colors hover:text-gold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mt-2 text-[11.5px] text-ink-500">
        Clic derecho sobre una fila para el menú de acciones · Mayús+clic en las casillas para
        seleccionar un rango ·{" "}
        <Link href="/contacts/new" className="text-ink-350 hover:text-gold">
          nuevo contacto
        </Link>
      </div>
    </div>
  );
}
