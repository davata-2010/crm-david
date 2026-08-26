"use client";

import { useEffect, useRef, useState } from "react";
import Tag from "@/components/Tag";
import { GOLD, tagStyle } from "@/lib/constants";
import { eur, relative } from "@/lib/format";
import type { FieldDef } from "@/lib/fields";

export type Row = Record<string, unknown> & { id: string };

export function getValue(row: Row, field: FieldDef): unknown {
  if (field.key.startsWith("custom.")) {
    const custom = (row.custom ?? {}) as Record<string, unknown>;
    return custom[field.key.slice(7)];
  }
  return row[field.key];
}

/* ------------------------------------------------------------ lectura --- */

export function CellDisplay({ row, field }: { row: Row; field: FieldDef }) {
  const raw = getValue(row, field);

  switch (field.type) {
    case "select": {
      if (!raw) return <Empty />;
      const opt = field.options?.find((o) => o.value === raw);
      if (!opt) return <span className="truncate text-ink-150">{String(raw)}</span>;
      return opt.color ? (
        <span
          className="inline-block truncate rounded-full px-[9px] py-[2px] text-[11px] font-semibold"
          style={{ background: opt.color, color: opt.fg ?? "#C8C8C8" }}
        >
          {opt.label}
        </span>
      ) : (
        <span className="truncate text-ink-150">{opt.label}</span>
      );
    }

    case "link": {
      if (!raw) return <Empty />;
      return (
        <span className="truncate rounded-[5px] border border-hair bg-ink-800 px-1.5 py-[1px] text-[11.5px] text-ink-150">
          {String(raw)}
        </span>
      );
    }

    case "multi": {
      const list = (raw as string[]) ?? [];
      if (!list.length) return <Empty />;
      return (
        <span className="flex gap-1 overflow-hidden">
          {list.slice(0, 3).map((t) => (
            <Tag key={t} tag={t} small />
          ))}
          {list.length > 3 && (
            <span className="text-[10px] text-ink-450">+{list.length - 3}</span>
          )}
        </span>
      );
    }

    case "currency":
      return <span className="tnum text-ink-100">{eur(Number(raw ?? 0))}</span>;

    case "number":
      return raw === null || raw === undefined || raw === "" ? (
        <Empty />
      ) : (
        <span className="tnum text-ink-100">{String(raw)}</span>
      );

    case "date":
    case "datetime":
      if (!raw) return <Empty />;
      return (
        <span className="truncate text-ink-250" title={new Date(String(raw)).toLocaleString("es-ES")}>
          {field.type === "date"
            ? new Date(String(raw)).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : relative(String(raw))}
        </span>
      );

    case "checkbox":
      return (
        <span
          className="grid h-[15px] w-[15px] place-items-center rounded-[4px] border text-[9px]"
          style={{
            borderColor: raw ? GOLD : "rgba(245,245,245,0.2)",
            background: raw ? GOLD : "transparent",
            color: "#080808",
          }}
        >
          {raw ? "✓" : ""}
        </span>
      );

    case "email":
      return raw ? (
        <span className="truncate text-ink-150">{String(raw)}</span>
      ) : (
        <Empty />
      );

    default:
      return raw ? (
        <span className="truncate text-ink-50">{String(raw)}</span>
      ) : (
        <Empty />
      );
  }
}

const Empty = () => <span className="text-ink-600 text-ink-500">—</span>;

/* ------------------------------------------------------------ edición --- */

export function CellEditor({
  row,
  field,
  allTags,
  onCommit,
  onCancel,
}: {
  row: Row;
  field: FieldDef;
  allTags: string[];
  onCommit: (value: string | string[] | null) => void;
  onCancel: () => void;
}) {
  const raw = getValue(row, field);
  const boxRef = useRef<HTMLDivElement>(null);

  // Cierra al pulsar fuera; los editores de lista lo necesitan.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onCancel]);

  /* --- select y link: lista de opciones --- */
  if (field.type === "select" || field.type === "link") {
    return (
      <div
        ref={boxRef}
        className="absolute left-0 top-0 z-30 max-h-[260px] w-[max(100%,190px)] overflow-auto rounded-[9px] border border-[rgba(245,245,245,0.14)] bg-ink-880 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
      >
        <button
          onClick={() => onCommit(null)}
          className="flex w-full items-center gap-2 px-3 py-[6px] text-left text-[12px] text-ink-400 hover:bg-[rgba(250,197,28,0.1)]"
        >
          — vaciar
        </button>
        {(field.options ?? []).map((o) => (
          <button
            key={o.value}
            onClick={() => onCommit(o.value)}
            className="flex w-full items-center gap-2 px-3 py-[6px] text-left text-[12.5px] hover:bg-[rgba(250,197,28,0.1)]"
          >
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: o.color ?? "#3A3A3A" }}
            />
            <span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
    );
  }

  /* --- multi: etiquetas --- */
  if (field.type === "multi") {
    return (
      <TagEditor
        boxRef={boxRef}
        value={(raw as string[]) ?? []}
        suggestions={allTags}
        onCommit={onCommit}
      />
    );
  }

  /* --- checkbox --- */
  if (field.type === "checkbox") {
    return (
      <div ref={boxRef} className="flex h-full items-center">
        <button
          onClick={() => onCommit(raw ? "" : "si")}
          className="grid h-[16px] w-[16px] place-items-center rounded-[4px] border text-[9px]"
          style={{
            borderColor: raw ? GOLD : "rgba(245,245,245,0.25)",
            background: raw ? GOLD : "transparent",
            color: "#080808",
          }}
        >
          {raw ? "✓" : ""}
        </button>
      </div>
    );
  }

  /* --- texto, email, teléfono, número, fecha --- */
  const inputType =
    field.type === "number" || field.type === "currency"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "email"
          ? "email"
          : "text";

  return (
    <div ref={boxRef} className="absolute inset-0 z-30">
      <input
        autoFocus
        type={inputType}
        defaultValue={raw ? String(raw) : ""}
        style={inputType === "date" ? { colorScheme: "dark" } : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={(e) => onCommit(e.target.value)}
        className="h-full w-full rounded-[4px] border-2 border-gold bg-ink-925 px-2 text-[12.5px] text-ink-50 outline-none"
      />
    </div>
  );
}

function TagEditor({
  boxRef,
  value,
  suggestions,
  onCommit,
}: {
  boxRef: React.RefObject<HTMLDivElement>;
  value: string[];
  suggestions: string[];
  onCommit: (v: string[]) => void;
}) {
  const [list, setList] = useState<string[]>(value);
  const [draft, setDraft] = useState("");

  const add = (t: string) => {
    const clean = t.trim();
    if (!clean || list.includes(clean) || list.length >= 12) return;
    setList([...list, clean]);
    setDraft("");
  };

  const available = suggestions.filter(
    (t) => !list.includes(t) && t.toLowerCase().includes(draft.toLowerCase())
  );

  return (
    <div
      ref={boxRef}
      className="absolute left-0 top-0 z-30 w-[max(100%,230px)] rounded-[9px] border border-[rgba(245,245,245,0.14)] bg-ink-880 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
    >
      <div className="flex flex-wrap gap-1">
        {list.map((t) => (
          <Tag key={t} tag={t} small onRemove={() => setList(list.filter((x) => x !== t))} />
        ))}
      </div>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
            else onCommit(list);
          }
          if (e.key === "Escape") onCommit(value);
          if (e.key === "Backspace" && !draft && list.length) setList(list.slice(0, -1));
        }}
        placeholder="Escribe y pulsa Intro"
        className="mt-1.5 w-full border-none bg-transparent text-[12px] text-ink-50 outline-none"
      />
      {available.length > 0 && (
        <div className="mt-1.5 max-h-[140px] overflow-auto border-t border-hair pt-1.5">
          {available.slice(0, 8).map((t) => {
            const st = tagStyle(t);
            return (
              <button
                key={t}
                onClick={() => add(t)}
                className="block w-full rounded px-1.5 py-[3px] text-left text-[11.5px] hover:bg-[rgba(250,197,28,0.1)]"
                style={{ color: st.fg }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onCommit(list)}
        className="mt-2 w-full rounded-[7px] bg-gold py-1 text-[11.5px] font-semibold text-ink-950"
      >
        Guardar
      </button>
    </div>
  );
}
