"use client";

import { useState } from "react";
import { GOLD } from "@/lib/constants";
import {
  OPS_BY_TYPE,
  OP_LABEL,
  OP_NEEDS_VALUE,
  type Condition,
  type FieldDef,
  type Op,
  type Sort,
  type ViewConfig,
  type ViewKind,
} from "@/lib/fields";

const VIEWS: { key: ViewKind; label: string; icon: string }[] = [
  { key: "grid", label: "Tabla", icon: "▦" },
  { key: "kanban", label: "Kanban", icon: "▤" },
  { key: "calendar", label: "Calendario", icon: "▩" },
  { key: "gallery", label: "Galería", icon: "▣" },
];

type Panel = "filters" | "sorts" | "group" | "fields" | "height" | null;

export default function ViewToolbar({
  config,
  fields,
  visibleKeys,
  onPatch,
  onSetFields,
  rowCount,
  total,
  extra,
}: {
  config: ViewConfig;
  fields: FieldDef[];
  visibleKeys: string[];
  onPatch: (patch: Record<string, string | null>) => void;
  onSetFields: (keys: string[]) => void;
  rowCount: number;
  total: number;
  extra?: React.ReactNode;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [term, setTerm] = useState(config.q);

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const enc = (v: unknown) => encodeURIComponent(JSON.stringify(v));

  const setFilters = (next: Condition[]) =>
    onPatch({ f: next.length ? enc(next) : null, page: null });
  const setSorts = (next: Sort[]) => onPatch({ s: next.length ? enc(next) : null, page: null });

  const groupable = fields.filter((f) => f.groupable);
  const dateFields = fields.filter((f) => f.type === "date" || f.type === "datetime");

  const Btn = ({
    id,
    label,
    count,
    icon,
  }: {
    id: Panel;
    label: string;
    count?: number;
    icon: string;
  }) => (
    <button
      onClick={() => toggle(id)}
      className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] transition-colors"
      style={{
        borderColor: count ? "rgba(250,197,28,0.4)" : "rgba(245,245,245,0.1)",
        background: panel === id ? "rgba(250,197,28,0.1)" : "transparent",
        color: count ? GOLD : "#B4B4B4",
      }}
    >
      <span className="text-[11px]">{icon}</span>
      {label}
      {!!count && <span className="tnum opacity-70">{count}</span>}
    </button>
  );

  return (
    <div className="relative border-b border-hair bg-ink-950">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6">
        {/* tipos de vista */}
        <div className="flex rounded-[9px] border border-[rgba(245,245,245,0.1)] p-0.5">
          {VIEWS.map((v) => {
            const active = config.view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => onPatch({ view: v.key === "grid" ? null : v.key, page: null })}
                className="flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? GOLD : "transparent",
                  color: active ? "#080808" : "#8A8A8A",
                }}
              >
                <span className="text-[10px]">{v.icon}</span>
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            );
          })}
        </div>

        <span className="h-5 w-px bg-[rgba(245,245,245,0.1)]" />

        <Btn id="filters" label="Filtrar" icon="⚟" count={config.filters.length} />
        <Btn id="sorts" label="Ordenar" icon="↕" count={config.sorts.length} />
        {config.view === "grid" && (
          <>
            <Btn id="group" label="Agrupar" icon="⊞" count={config.groupBy ? 1 : 0} />
            <Btn
              id="fields"
              label="Campos"
              icon="▤"
              count={visibleKeys.length < fields.length ? fields.length - visibleKeys.length : 0}
            />
            <Btn id="height" label="Altura" icon="≡" />
          </>
        )}
        {config.view === "kanban" && (
          <select
            value={config.kanbanBy}
            onChange={(e) => onPatch({ kb: e.target.value })}
            className="rounded-[8px] border border-[rgba(245,245,245,0.1)] bg-transparent px-2 py-1.5 text-[12px] text-ink-150 outline-none"
          >
            {groupable.map((f) => (
              <option key={f.key} value={f.key}>
                Apilar por {f.label}
              </option>
            ))}
          </select>
        )}
        {config.view === "calendar" && (
          <select
            value={config.calendarBy}
            onChange={(e) => onPatch({ cb: e.target.value })}
            className="rounded-[8px] border border-[rgba(245,245,245,0.1)] bg-transparent px-2 py-1.5 text-[12px] text-ink-150 outline-none"
          >
            {dateFields.map((f) => (
              <option key={f.key} value={f.key}>
                Por {f.label}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onPatch({ q: term || null, page: null });
          }}
          className="flex items-center gap-1.5 rounded-[8px] border border-[rgba(245,245,245,0.1)] px-2.5 py-1.5"
        >
          <span className="text-[11px] text-ink-450">⌕</span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => onPatch({ q: term || null, page: null })}
            placeholder="Buscar…"
            className="w-[130px] border-none bg-transparent text-[12px] text-ink-50 outline-none"
          />
        </form>

        <span className="tnum text-[11.5px] text-ink-400">
          {rowCount === total ? `${total}` : `${rowCount} de ${total}`}
        </span>

        {extra}
      </div>

      {/* ------------------------------------------------------- paneles --- */}
      {panel && (
        <div className="absolute left-4 top-full z-40 mt-1 w-[min(520px,calc(100vw-2rem))] rounded-[12px] border border-[rgba(245,245,245,0.12)] bg-ink-880 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] lg:left-6">
          {panel === "filters" && (
            <FilterPanel
              fields={fields}
              value={config.filters}
              onChange={setFilters}
              onClose={() => setPanel(null)}
            />
          )}

          {panel === "sorts" && (
            <SortPanel fields={fields} value={config.sorts} onChange={setSorts} />
          )}

          {panel === "group" && (
            <div>
              <PanelTitle>Agrupar filas por</PanelTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip
                  active={!config.groupBy}
                  onClick={() => onPatch({ group: null })}
                  label="Sin agrupar"
                />
                {groupable.map((f) => (
                  <Chip
                    key={f.key}
                    active={config.groupBy === f.key}
                    onClick={() => onPatch({ group: f.key })}
                    label={f.label}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-[1.5] text-ink-450">
                Al agrupar se carga el conjunto completo (hasta 1.000 filas) en vez de una
                página, para que los totales por grupo sean reales.
              </p>
            </div>
          )}

          {panel === "fields" && (
            <FieldsPanel
              fields={fields}
              visible={visibleKeys}
              onChange={onSetFields}
            />
          )}

          {panel === "height" && (
            <div>
              <PanelTitle>Altura de fila</PanelTitle>
              <div className="mt-2 flex gap-1.5">
                {(["corta", "media", "alta"] as const).map((h) => (
                  <Chip
                    key={h}
                    active={config.rowH === h}
                    onClick={() => onPatch({ rowh: h === "corta" ? null : h })}
                    label={h}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ paneles --- */

const PanelTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] uppercase tracking-[0.1em] text-ink-350">{children}</div>
);

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[11.5px] font-medium capitalize transition-colors"
      style={{
        background: active ? GOLD : "#111111",
        color: active ? "#080808" : "#B4B4B4",
        border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
      }}
    >
      {label}
    </button>
  );
}

function FilterPanel({
  fields,
  value,
  onChange,
  onClose,
}: {
  fields: FieldDef[];
  value: Condition[];
  onChange: (v: Condition[]) => void;
  onClose: () => void;
}) {
  const set = (i: number, patch: Partial<Condition>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div>
      <div className="flex items-center">
        <PanelTitle>Filtros</PanelTitle>
        <div className="flex-1" />
        {value.length > 0 && (
          <button
            onClick={() => {
              onChange([]);
              onClose();
            }}
            className="text-[11px] text-ink-400 hover:text-gold"
          >
            Limpiar todo
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {value.length === 0 && (
          <p className="text-[11.5px] text-ink-450">
            Sin filtros. Se muestran todos los registros.
          </p>
        )}

        {value.map((c, i) => {
          const field = fields.find((f) => f.key === c.field) ?? fields[0];
          const ops = OPS_BY_TYPE[field.type];
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[38px] text-[11px] text-ink-450">{i === 0 ? "Donde" : "y"}</span>
              <select
                value={c.field}
                onChange={(e) => {
                  const nf = fields.find((f) => f.key === e.target.value)!;
                  set(i, { field: nf.key, op: OPS_BY_TYPE[nf.type][0], value: "" });
                }}
                className="rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={c.op}
                onChange={(e) => set(i, { op: e.target.value as Op })}
                className="rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
              >
                {ops.map((o) => (
                  <option key={o} value={o}>
                    {OP_LABEL[o]}
                  </option>
                ))}
              </select>

              {OP_NEEDS_VALUE(c.op) &&
                (field.options ? (
                  <select
                    value={c.value}
                    onChange={(e) => set(i, { value: e.target.value })}
                    className="min-w-[110px] flex-1 rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
                  >
                    <option value="">—</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={c.value}
                    onChange={(e) => set(i, { value: e.target.value })}
                    type={
                      field.type === "date" || field.type === "datetime"
                        ? "date"
                        : field.type === "number" || field.type === "currency"
                          ? "number"
                          : "text"
                    }
                    style={
                      field.type === "date" || field.type === "datetime"
                        ? { colorScheme: "dark" }
                        : undefined
                    }
                    placeholder="valor"
                    className="min-w-[110px] flex-1 rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
                  />
                ))}

              <button
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="px-1 text-[12px] text-ink-500 hover:text-[#FF8F7A]"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() =>
          onChange([...value, { field: fields[0].key, op: OPS_BY_TYPE[fields[0].type][0], value: "" }])
        }
        className="mt-3 text-[12px] text-gold"
      >
        + Añadir condición
      </button>
    </div>
  );
}

function SortPanel({
  fields,
  value,
  onChange,
}: {
  fields: FieldDef[];
  value: Sort[];
  onChange: (v: Sort[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center">
        <PanelTitle>Orden</PanelTitle>
        <div className="flex-1" />
        {value.length > 0 && (
          <button onClick={() => onChange([])} className="text-[11px] text-ink-400 hover:text-gold">
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {value.length === 0 && (
          <p className="text-[11.5px] text-ink-450">
            Por defecto se ordena por última actividad, de más reciente a más antigua.
          </p>
        )}
        {value.map((srt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-[46px] text-[11px] text-ink-450">
              {i === 0 ? "Primero" : "luego"}
            </span>
            <select
              value={srt.field}
              onChange={(e) =>
                onChange(value.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))
              }
              className="flex-1 rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
            >
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={srt.dir}
              onChange={(e) =>
                onChange(
                  value.map((x, idx) =>
                    idx === i ? { ...x, dir: e.target.value as "asc" | "desc" } : x
                  )
                )
              }
              className="rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] text-ink-100 outline-none"
            >
              <option value="asc">ascendente</option>
              <option value="desc">descendente</option>
            </select>
            <button
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="px-1 text-[12px] text-ink-500 hover:text-[#FF8F7A]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange([...value, { field: "name", dir: "asc" }])}
        className="mt-3 text-[12px] text-gold"
      >
        + Añadir criterio
      </button>
    </div>
  );
}

function FieldsPanel({
  fields,
  visible,
  onChange,
}: {
  fields: FieldDef[];
  visible: string[];
  onChange: (keys: string[]) => void;
}) {
  const move = (key: string, delta: number) => {
    const idx = visible.indexOf(key);
    const next = [...visible];
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center">
        <PanelTitle>Campos visibles</PanelTitle>
        <div className="flex-1" />
        <button
          onClick={() => onChange(fields.map((f) => f.key))}
          className="text-[11px] text-ink-400 hover:text-gold"
        >
          Mostrar todos
        </button>
      </div>

      <div className="mt-2 max-h-[300px] overflow-auto">
        {fields.map((f) => {
          const on = visible.includes(f.key);
          return (
            <div key={f.key} className="flex items-center gap-2 py-[3px]">
              <button
                onClick={() =>
                  onChange(on ? visible.filter((k) => k !== f.key) : [...visible, f.key])
                }
                className="flex h-[18px] w-[30px] items-center rounded-full p-0"
                style={{
                  background: on ? GOLD : "#1A1A1A",
                  border: `1px solid ${on ? GOLD : "rgba(245,245,245,0.12)"}`,
                  justifyContent: on ? "flex-end" : "flex-start",
                }}
              >
                <span
                  className="mx-[2px] h-[12px] w-[12px] rounded-full"
                  style={{ background: on ? "#080808" : "#5A5A5A" }}
                />
              </button>
              <span className="flex-1 truncate text-[12.5px]">{f.label}</span>
              {f.readOnly && <span className="text-[10px] text-ink-500">calculado</span>}
              {on && (
                <>
                  <button
                    onClick={() => move(f.key, -1)}
                    className="px-1 text-[11px] text-ink-500 hover:text-gold"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(f.key, 1)}
                    className="px-1 text-[11px] text-ink-500 hover:text-gold"
                  >
                    ↓
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
