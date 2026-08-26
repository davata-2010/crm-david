"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { CellDisplay, CellEditor, getValue, type Row } from "./Cell";
import { GOLD } from "@/lib/constants";
import { eur } from "@/lib/format";
import { ROW_HEIGHT, type FieldDef, type ViewConfig } from "@/lib/fields";

type Active = { rowIndex: number; colIndex: number } | null;

export default function DataGrid({
  rows,
  fields,
  config,
  allTags,
  selected,
  canWrite,
  onToggleRow,
  onToggleAll,
  onEdit,
  onOpen,
  onRowMenu,
  onHeaderMenu,
  onResize,
  onQuickCreate,
}: {
  rows: Row[];
  fields: FieldDef[];
  config: ViewConfig;
  allTags: string[];
  selected: Set<string>;
  canWrite: boolean;
  onToggleRow: (id: string, index: number, shift: boolean) => void;
  onToggleAll: () => void;
  onEdit: (id: string, key: string, value: string | string[] | null) => void;
  onOpen: (row: Row) => void;
  onRowMenu: (e: React.MouseEvent, row: Row) => void;
  onHeaderMenu: (e: React.MouseEvent, field: FieldDef) => void;
  onResize: (key: string, width: number) => void;
  onQuickCreate: (name: string) => void;
}) {
  const { openMenu } = useChrome();
  const [active, setActive] = useState<Active>(null);
  const [editing, setEditing] = useState<Active>(null);
  const [draft, setDraft] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowH = ROW_HEIGHT[config.rowH];

  const widths = fields.map((f) => config.widths[f.key] ?? f.width);
  const template = `40px ${widths.map((w) => `${w}px`).join(" ")} 44px`;

  /* ------------------------------------------------------ agrupación --- */

  const groupField = config.groupBy ? fields.find((f) => f.key === config.groupBy) : null;

  const groups = useMemo(() => {
    type Group = { key: string; label: string; rows: Row[]; color?: string };
    if (!groupField) return [{ key: "__all__", label: "", rows }] as Group[];
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const raw = getValue(r, groupField);
      const key = Array.isArray(raw)
        ? (raw as string[])[0] ?? "—"
        : raw === null || raw === undefined || raw === ""
          ? "—"
          : String(raw);
      map.set(key, [...(map.get(key) ?? []), r]);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => {
        const opt = groupField.options?.find((o) => o.value === key);
        return { key, label: opt?.label ?? key, rows: list, color: opt?.color } as Group;
      });
  }, [rows, groupField]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /** Filas visibles en orden, para que el teclado navegue como se ve. */
  const flat = useMemo(() => {
    const out: Row[] = [];
    groups.forEach((g) => {
      if (!collapsed.has(g.key)) out.push(...g.rows);
    });
    return out;
  }, [groups, collapsed]);

  /* -------------------------------------------------------- teclado --- */

  const commit = useCallback(
    (value: string | string[] | null) => {
      if (!editing) return;
      const row = flat[editing.rowIndex];
      const field = fields[editing.colIndex];
      if (row && field) {
        const current = getValue(row, field);
        const same = Array.isArray(current)
          ? JSON.stringify(current) === JSON.stringify(value)
          : String(current ?? "") === String(value ?? "");
        if (!same) onEdit(row.id, field.writeKey ?? field.key, value);
      }
      setEditing(null);
    },
    [editing, flat, fields, onEdit]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (editing || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!active) return;

      const max = flat.length - 1;
      const lastCol = fields.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive({ ...active, rowIndex: Math.min(active.rowIndex + 1, max) });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive({ ...active, rowIndex: Math.max(active.rowIndex - 1, 0) });
      } else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setActive({ ...active, colIndex: Math.min(active.colIndex + 1, lastCol) });
      } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setActive({ ...active, colIndex: Math.max(active.colIndex - 1, 0) });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const field = fields[active.colIndex];
        if (canWrite && !field.readOnly) setEditing(active);
      } else if (e.key === " ") {
        e.preventDefault();
        const row = flat[active.rowIndex];
        if (row) onOpen(row);
      } else if (e.key === "Escape") {
        setActive(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, editing, flat, fields, canWrite, onOpen]);

  /* ------------------------------------------------- redimensionado --- */

  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      const next = Math.max(70, drag.current.startW + (e.clientX - drag.current.startX));
      const el = wrapRef.current?.style;
      if (el) el.setProperty("--resizing", String(next));
      onResize(drag.current.key, next);
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onResize]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  /* --------------------------------------------------------- render --- */

  let runningIndex = -1;

  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto">
      <div style={{ minWidth: "fit-content" }}>
        {/* cabecera */}
        <div
          className="sticky top-0 z-20 grid border-b border-hair bg-ink-915"
          style={{ gridTemplateColumns: template }}
        >
          <label className="flex items-center justify-center border-r border-[rgba(245,245,245,0.05)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-[13px] w-[13px] accent-[#FAC51C]"
            />
          </label>

          {fields.map((f, i) => {
            const sort = config.sorts.find((s) => s.field === f.key);
            return (
              <div
                key={f.key}
                onContextMenu={(e) => onHeaderMenu(e, f)}
                className="group relative flex items-center gap-1.5 border-r border-[rgba(245,245,245,0.05)] px-2.5 py-2.5"
                title={f.hint}
              >
                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-350">
                  {f.label}
                </span>
                {sort && (
                  <span className="text-[9px]" style={{ color: GOLD }}>
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
                {f.readOnly && <span className="text-[9px] text-ink-500">ƒ</span>}
                <button
                  onClick={(e) => onHeaderMenu(e, f)}
                  className="ml-auto text-[11px] text-ink-500 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ▾
                </button>
                <span
                  onMouseDown={(e) => {
                    drag.current = {
                      key: f.key,
                      startX: e.clientX,
                      startW: config.widths[f.key] ?? f.width,
                    };
                    e.preventDefault();
                  }}
                  className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize hover:bg-[rgba(250,197,28,0.5)]"
                />
              </div>
            );
          })}

          <button
            onClick={(e) =>
              openMenu(e, [
                { kind: "label", label: "Columnas" },
                { label: "Gestionar campos…", icon: "▦", onSelect: () => onHeaderMenu(e, fields[0]) },
              ])
            }
            className="flex items-center justify-center text-[13px] text-ink-500 hover:text-gold"
          >
            +
          </button>
        </div>

        {/* filas */}
        {groups.map((g) => (
          <div key={g.key}>
            {groupField && (
              <button
                onClick={() =>
                  setCollapsed((prev) => {
                    const n = new Set(prev);
                    if (n.has(g.key)) n.delete(g.key);
                    else n.add(g.key);
                    return n;
                  })
                }
                className="sticky left-0 flex w-full items-center gap-2.5 border-b border-hair bg-ink-920 px-3 py-2 text-left"
              >
                <span className="text-[10px] text-ink-450">
                  {collapsed.has(g.key) ? "▸" : "▾"}
                </span>
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: g.color ?? "#3A3A3A" }}
                />
                <span className="text-[12.5px] font-semibold">{g.label}</span>
                <span className="tnum text-[11px] text-ink-400">{g.rows.length}</span>
                <span className="flex-1" />
                <span className="tnum text-[11px] text-ink-400">
                  {eur(g.rows.reduce((a, r) => a + Number(r.open_value ?? 0), 0))}
                </span>
              </button>
            )}

            {!collapsed.has(g.key) &&
              g.rows.map((row) => {
                runningIndex += 1;
                const rowIndex = runningIndex;
                const isSel = selected.has(row.id);
                return (
                  <div
                    key={row.id}
                    onContextMenu={(e) => onRowMenu(e, row)}
                    className="group grid border-b border-[rgba(245,245,245,0.05)] transition-colors hover:bg-ink-870"
                    style={{
                      gridTemplateColumns: template,
                      background: isSel ? "rgba(250,197,28,0.06)" : undefined,
                      minHeight: rowH,
                    }}
                  >
                    <label className="flex items-center justify-center border-r border-[rgba(245,245,245,0.04)]">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) =>
                          onToggleRow(
                            row.id,
                            rowIndex,
                            (e.nativeEvent as MouseEvent).shiftKey === true
                          )
                        }
                        className="h-[13px] w-[13px] accent-[#FAC51C]"
                      />
                    </label>

                    {fields.map((f, colIndex) => {
                      const isActive =
                        active?.rowIndex === rowIndex && active?.colIndex === colIndex;
                      const isEditing =
                        editing?.rowIndex === rowIndex && editing?.colIndex === colIndex;
                      const editable = canWrite && !f.readOnly;
                      return (
                        <div
                          key={f.key}
                          onClick={() => setActive({ rowIndex, colIndex })}
                          onDoubleClick={() => editable && setEditing({ rowIndex, colIndex })}
                          className="relative flex items-center overflow-hidden border-r border-[rgba(245,245,245,0.04)] px-2.5 text-[12.5px]"
                          style={{
                            boxShadow: isActive ? `inset 0 0 0 2px ${GOLD}` : undefined,
                            cursor: editable ? "cell" : "default",
                          }}
                        >
                          {isEditing ? (
                            <CellEditor
                              row={row}
                              field={f}
                              allTags={allTags}
                              onCommit={commit}
                              onCancel={() => setEditing(null)}
                            />
                          ) : (
                            <CellDisplay row={row} field={f} />
                          )}
                        </div>
                      );
                    })}

                    <button
                      onClick={() => onOpen(row)}
                      title="Abrir ficha (barra espaciadora)"
                      className="flex items-center justify-center text-[12px] text-ink-500 opacity-0 transition-opacity hover:text-gold group-hover:opacity-100"
                    >
                      ⤢
                    </button>
                  </div>
                );
              })}
          </div>
        ))}

        {/* alta rápida */}
        {canWrite && !config.groupBy && (
          <div
            className="grid border-b border-[rgba(245,245,245,0.05)]"
            style={{ gridTemplateColumns: template, minHeight: rowH }}
          >
            <div className="flex items-center justify-center text-[13px] text-ink-600">+</div>
            <div className="col-span-full flex items-center px-2.5" style={{ gridColumn: "2 / -1" }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    onQuickCreate(draft.trim());
                    setDraft("");
                  }
                }}
                placeholder="Escribe un nombre y pulsa Intro para crear un contacto…"
                className="w-full border-none bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-ink-500"
              />
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="px-6 py-16 text-center text-[12.5px] text-ink-400">
            Ningún registro coincide con los filtros.
          </div>
        )}
      </div>
    </div>
  );
}
