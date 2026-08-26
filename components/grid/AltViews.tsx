"use client";

import { useMemo, useState } from "react";
import { CellDisplay, getValue, type Row } from "./Cell";
import Tag from "@/components/Tag";
import { GOLD } from "@/lib/constants";
import { eur, initials } from "@/lib/format";
import type { FieldDef } from "@/lib/fields";

/* ================================================================ kanban == */

export function KanbanView({
  rows,
  fields,
  groupField,
  canWrite,
  onEdit,
  onOpen,
  onRowMenu,
}: {
  rows: Row[];
  fields: FieldDef[];
  groupField: FieldDef;
  canWrite: boolean;
  onEdit: (id: string, key: string, value: string | null) => void;
  onOpen: (row: Row) => void;
  onRowMenu: (e: React.MouseEvent, row: Row) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columns = useMemo(() => {
    const opts = groupField.options ?? [];
    const known = opts.map((o) => ({
      key: o.value,
      label: o.label,
      color: o.color,
      rows: rows.filter((r) => String(getValue(r, groupField) ?? "") === o.value),
    }));
    const rest = rows.filter(
      (r) => !opts.some((o) => o.value === String(getValue(r, groupField) ?? ""))
    );
    return [...known, { key: "__none__", label: "Sin asignar", color: undefined, rows: rest }];
  }, [rows, groupField]);

  const writeKey = groupField.writeKey ?? groupField.key;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
      <div
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(230px, 1fr))` }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => {
              if (!canWrite) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => {
              setOverCol(null);
              if (!canWrite || !dragId) return;
              onEdit(dragId, writeKey, col.key === "__none__" ? null : col.key);
              setDragId(null);
            }}
            className="min-h-[380px] rounded-xl2 border border-dashed px-3 pb-3 pt-3.5 transition-colors"
            style={{
              background: overCol === col.key ? "rgba(250,197,28,0.07)" : "#0E0E0E",
              borderColor: overCol === col.key ? GOLD : "rgba(245,245,245,0.08)",
            }}
          >
            <div className="flex items-center gap-2 pb-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: col.color ?? "#3A3A3A" }}
              />
              <span className="flex-1 truncate text-[12px] font-semibold">{col.label}</span>
              <span className="tnum text-[11px] text-ink-400">{col.rows.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {col.rows.map((row) => (
                <div
                  key={row.id}
                  draggable={canWrite}
                  onDragStart={() => setDragId(row.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(row)}
                  onContextMenu={(e) => onRowMenu(e, row)}
                  className="cursor-pointer rounded-[11px] border border-[rgba(245,245,245,0.08)] bg-ink-800 px-3 py-2.5 transition-colors hover:border-[rgba(250,197,28,0.45)]"
                  style={{ opacity: dragId === row.id ? 0.4 : 1 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-hair bg-ink-900 text-[9.5px] font-semibold text-ink-150">
                      {initials(String(row.name ?? "?"))}
                    </span>
                    <span className="truncate text-[12.5px] font-semibold">
                      {String(row.name ?? "")}
                    </span>
                  </div>
                  {!!row.company_name && (
                    <div className="mt-1.5 truncate text-[11px] text-ink-350">
                      {String(row.company_name)}
                    </div>
                  )}
                  {((row.tags as string[]) ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {((row.tags as string[]) ?? []).slice(0, 3).map((t) => (
                        <Tag key={t} tag={t} small />
                      ))}
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center justify-between border-t border-[rgba(245,245,245,0.06)] pt-2">
                    <span className="tnum text-[12px] font-semibold text-gold">
                      {eur(Number(row.open_value ?? 0))}
                    </span>
                    <span className="text-[10.5px] text-ink-400">
                      {Number(row.open_deals ?? 0)} deals
                    </span>
                  </div>
                </div>
              ))}
              {col.rows.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-[rgba(245,245,245,0.07)] px-3 py-6 text-center text-[11px] text-ink-500">
                  Suelta aquí
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ calendario == */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

export function CalendarView({
  rows,
  dateField,
  onOpen,
  onRowMenu,
}: {
  rows: Row[];
  dateField: FieldDef;
  onOpen: (row: Row) => void;
  onRowMenu: (e: React.MouseEvent, row: Row) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const raw = getValue(r, dateField);
      if (!raw) return;
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    });
    return map;
  }, [rows, dateField]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-2.5 py-1 text-[12px] text-ink-150 hover:text-gold"
        >
          ‹
        </button>
        <span className="text-[14px] font-semibold capitalize">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-2.5 py-1 text-[12px] text-ink-150 hover:text-gold"
        >
          ›
        </button>
        <button
          onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[12px] text-ink-150 hover:text-gold"
        >
          Hoy
        </button>
        <div className="flex-1" />
        <span className="text-[11.5px] text-ink-400">Agrupado por {dateField.label}</span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl2 bg-hair">
        {DOW.map((d) => (
          <div
            key={d}
            className="bg-ink-915 py-2 text-center text-[10.5px] uppercase tracking-[0.1em] text-ink-400"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const list = day ? byDay.get(`${year}-${month}-${day}`) ?? [] : [];
          return (
            <div
              key={i}
              className="min-h-[104px] bg-ink-900 p-1.5"
              style={{ opacity: day ? 1 : 0.35 }}
            >
              {day && (
                <div
                  className="tnum mb-1 text-[11px]"
                  style={{ color: isToday(day) ? GOLD : "#6E6E6E" }}
                >
                  {day}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {list.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r)}
                    onContextMenu={(e) => onRowMenu(e, r)}
                    className="truncate rounded-[6px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.08)] px-1.5 py-[3px] text-left text-[10.5px] text-gold"
                  >
                    {String(r.name ?? "")}
                  </button>
                ))}
                {list.length > 3 && (
                  <span className="px-1 text-[10px] text-ink-450">+{list.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================================== galería == */

export function GalleryView({
  rows,
  fields,
  onOpen,
  onRowMenu,
}: {
  rows: Row[];
  fields: FieldDef[];
  onOpen: (row: Row) => void;
  onRowMenu: (e: React.MouseEvent, row: Row) => void;
}) {
  const shown = fields.filter((f) => !["name"].includes(f.key)).slice(0, 5);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => onOpen(row)}
            onContextMenu={(e) => onRowMenu(e, row)}
            className="panel p-4 text-left transition-colors hover:border-[rgba(250,197,28,0.35)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(250,197,28,0.3)] bg-ink-800 text-[13px] font-semibold text-gold">
                {initials(String(row.name ?? "?"))}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">{String(row.name ?? "")}</div>
                <div className="truncate text-[11.5px] text-ink-400">
                  {String(row.company_name ?? row.email ?? "—")}
                </div>
              </div>
            </div>
            <div className="mt-3.5 flex flex-col gap-1.5 border-t border-hair pt-3">
              {shown.map((f) => (
                <div key={f.key} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="w-[92px] shrink-0 truncate text-ink-450">{f.label}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <CellDisplay row={row} field={f} />
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="panel px-6 py-14 text-center text-[12.5px] text-ink-400 sm:col-span-2 xl:col-span-3">
            Ningún registro coincide con los filtros.
          </div>
        )}
      </div>
    </div>
  );
}
