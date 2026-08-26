"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CellDisplay, CellEditor, getValue, type Row } from "./Cell";
import { GOLD } from "@/lib/constants";
import { initials } from "@/lib/format";
import { memberName } from "@/lib/workspace-client";
import type { FieldDef } from "@/lib/fields";
import type { Membership } from "@/lib/types";

/**
 * Ficha expandida al estilo Airtable: se abre sobre la vista, edita los
 * mismos campos y se cierra con Escape.
 */
export default function RecordPanel({
  row,
  fields,
  allTags,
  canWrite,
  members,
  onEdit,
  onClose,
}: {
  row: Row;
  fields: FieldDef[];
  allTags: string[];
  canWrite: boolean;
  members: Membership[];
  onEdit: (id: string, key: string, value: string | string[] | null) => void;
  onClose: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingKey) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingKey]);

  if (!mounted) return null;

  const editable = fields.filter((f) => !f.readOnly);
  const computed = fields.filter((f) => f.readOnly);

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex justify-end bg-[rgba(4,4,4,0.6)]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-hair bg-ink-900 shadow-[-24px_0_60px_rgba(0,0,0,0.5)]"
      >
        {/* cabecera */}
        <div className="flex items-center gap-3.5 border-b border-hair px-6 py-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(250,197,28,0.35)] bg-ink-800 text-[15px] font-semibold text-gold">
            {initials(String(row.name ?? "?"))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-semibold tracking-[-0.02em]">
              {String(row.name ?? "")}
            </div>
            <div className="truncate text-[12px] text-ink-400">
              {String(row.company_name ?? "Sin empresa")} ·{" "}
              {memberName(members, (row.assigned_to as string) ?? null)}
            </div>
          </div>
          <Link
            href={`/contacts/${row.id}`}
            className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-3 py-1.5 text-[12px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
          >
            Ficha completa
          </Link>
          <button
            onClick={onClose}
            className="rounded-[8px] px-2 py-1.5 text-[14px] text-ink-500 hover:text-gold"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* campos */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-450">Campos</div>
          <div className="mt-2">
            {editable.map((f) => (
              <div key={f.key} className="hair-t flex items-start gap-3 py-2.5">
                <span className="w-[120px] shrink-0 pt-[3px] text-[11.5px] text-ink-400">
                  {f.label}
                </span>
                <div
                  className="relative min-h-[24px] flex-1 cursor-cell rounded-[6px] px-2 py-[3px] text-[12.5px] transition-colors hover:bg-ink-870"
                  onClick={() => canWrite && setEditingKey(f.key)}
                >
                  {editingKey === f.key ? (
                    <CellEditor
                      row={row}
                      field={f}
                      allTags={allTags}
                      onCommit={(v) => {
                        const current = getValue(row, f);
                        const same = Array.isArray(current)
                          ? JSON.stringify(current) === JSON.stringify(v)
                          : String(current ?? "") === String(v ?? "");
                        if (!same) onEdit(row.id, f.writeKey ?? f.key, v);
                        setEditingKey(null);
                      }}
                      onCancel={() => setEditingKey(null)}
                    />
                  ) : (
                    <CellDisplay row={row} field={f} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-[10.5px] uppercase tracking-[0.12em] text-ink-450">
            Calculados
          </div>
          <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-hair">
            {computed.map((f) => (
              <div key={f.key} className="bg-ink-880 px-3.5 py-3">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink-450">
                  {f.label}
                </div>
                <div className="mt-1 text-[14px] font-semibold" style={{ color: GOLD }}>
                  <CellDisplay row={row} field={f} />
                </div>
              </div>
            ))}
          </div>

          {!canWrite && (
            <p className="mt-5 rounded-[9px] border border-hair bg-ink-800 px-3 py-2.5 text-[11.5px] text-ink-350">
              Tu rol es de sólo lectura: puedes consultar pero no modificar.
            </p>
          )}
        </div>

        <div className="border-t border-hair px-6 py-3 text-[11px] text-ink-500">
          Pulsa un campo para editarlo · Esc para cerrar
        </div>
      </div>
    </div>,
    document.body
  );
}
