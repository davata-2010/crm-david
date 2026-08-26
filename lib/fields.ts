import { CONTACT_STATUSES, STATUS } from "./constants";
import type { CustomField, Membership } from "./types";

/* ============================================================== tipos ==== */

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "select"
  | "multi"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "link"
  | "checkbox";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** Ancho por defecto de la columna, en píxeles. */
  width: number;
  /** Campos calculados: se muestran pero no se editan. */
  readOnly?: boolean;
  /** Opciones fijas (select) o dinámicas (empresas, miembros). */
  options?: { value: string; label: string; color?: string; fg?: string }[];
  /** Columna real de la tabla que se escribe al editar, si difiere de key. */
  writeKey?: string;
  /** Se puede agrupar por él. */
  groupable?: boolean;
  hint?: string;
};

export type Op =
  | "is"
  | "isNot"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "hasAny"
  | "before"
  | "after";

export type Condition = { field: string; op: Op; value: string };
export type Sort = { field: string; dir: "asc" | "desc" };

export type ViewKind = "grid" | "kanban" | "calendar" | "gallery";

export type ViewConfig = {
  view: ViewKind;
  filters: Condition[];
  sorts: Sort[];
  groupBy: string | null;
  /** Claves visibles, en orden. Vacío = todas las de por defecto. */
  fields: string[];
  widths: Record<string, number>;
  rowH: "corta" | "media" | "alta";
  kanbanBy: string;
  calendarBy: string;
  q: string;
  page: number;
  per: number;
};

/* ====================================================== definición ==== */

const STATUS_OPTIONS = CONTACT_STATUSES.map((s) => ({
  value: s,
  label: STATUS[s].label,
  color: STATUS[s].bg,
  fg: STATUS[s].fg,
}));

/** Campos del contacto. Los calculados salen de la vista `contact_rows`. */
export function contactFields(
  companies: { id: string; name: string }[],
  members: Membership[],
  custom: CustomField[]
): FieldDef[] {
  return [
    { key: "name", label: "Nombre", type: "text", width: 210, groupable: false },
    { key: "email", label: "Email", type: "email", width: 210 },
    {
      key: "status",
      label: "Estado",
      type: "select",
      width: 120,
      options: STATUS_OPTIONS,
      groupable: true,
    },
    {
      key: "company_name",
      label: "Empresa",
      type: "link",
      width: 170,
      writeKey: "company_id",
      groupable: true,
      options: companies.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "assigned_to",
      label: "Responsable",
      type: "select",
      width: 150,
      groupable: true,
      options: members.map((m) => ({
        value: m.user_id,
        label: m.profile?.full_name || m.profile?.email || "Miembro",
      })),
    },
    { key: "tags", label: "Etiquetas", type: "multi", width: 190, groupable: true },
    { key: "role", label: "Cargo", type: "text", width: 150 },
    { key: "phone", label: "Teléfono", type: "phone", width: 150 },
    {
      key: "open_value",
      label: "Valor abierto",
      type: "currency",
      width: 130,
      readOnly: true,
      hint: "Suma de sus deals abiertos",
    },
    {
      key: "open_deals",
      label: "Deals",
      type: "number",
      width: 80,
      readOnly: true,
      hint: "Deals abiertos",
    },
    {
      key: "open_tasks",
      label: "Tareas",
      type: "number",
      width: 80,
      readOnly: true,
      hint: "Tareas pendientes",
    },
    {
      key: "last_activity",
      label: "Última actividad",
      type: "datetime",
      width: 150,
      readOnly: true,
    },
    { key: "source", label: "Origen", type: "text", width: 150, groupable: true },
    { key: "created_at", label: "Alta", type: "date", width: 120, readOnly: true },
    ...custom.map(
      (f): FieldDef => ({
        key: `custom.${f.key}`,
        label: f.label,
        type:
          f.type === "select"
            ? "select"
            : f.type === "number"
              ? "number"
              : f.type === "date"
                ? "date"
                : f.type === "checkbox"
                  ? "checkbox"
                  : "text",
        width: 150,
        groupable: f.type === "select" || f.type === "checkbox",
        options: f.options.map((o) => ({ value: o, label: o })),
      })
    ),
  ];
}

export const DEFAULT_FIELDS = [
  "name",
  "email",
  "status",
  "company_name",
  "assigned_to",
  "tags",
  "open_value",
  "open_deals",
  "last_activity",
];

/* ======================================================= operadores ==== */

export const OPS_BY_TYPE: Record<FieldType, Op[]> = {
  text: ["contains", "notContains", "is", "isNot", "isEmpty", "isNotEmpty"],
  email: ["contains", "is", "isEmpty", "isNotEmpty"],
  phone: ["contains", "isEmpty", "isNotEmpty"],
  select: ["is", "isNot", "isEmpty", "isNotEmpty"],
  multi: ["hasAny", "isEmpty", "isNotEmpty"],
  number: ["is", "gt", "gte", "lt", "lte"],
  currency: ["gt", "gte", "lt", "lte", "is"],
  date: ["before", "after", "isEmpty", "isNotEmpty"],
  datetime: ["before", "after", "isEmpty", "isNotEmpty"],
  link: ["is", "isNot", "isEmpty", "isNotEmpty"],
  checkbox: ["is"],
};

export const OP_LABEL: Record<Op, string> = {
  is: "es",
  isNot: "no es",
  contains: "contiene",
  notContains: "no contiene",
  isEmpty: "está vacío",
  isNotEmpty: "no está vacío",
  gt: "mayor que",
  gte: "mayor o igual",
  lt: "menor que",
  lte: "menor o igual",
  hasAny: "incluye",
  before: "antes de",
  after: "después de",
};

export const OP_NEEDS_VALUE = (op: Op) => op !== "isEmpty" && op !== "isNotEmpty";

/* ==================================================== URL <-> config ==== */

const decode = <T,>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return fallback;
  }
};

export const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));

export function parseViewConfig(sp: Record<string, string | undefined>): ViewConfig {
  const per = Math.min(500, Math.max(10, Number(sp.per) || 50));
  return {
    view: (["grid", "kanban", "calendar", "gallery"] as const).includes(sp.view as ViewKind)
      ? (sp.view as ViewKind)
      : "grid",
    filters: decode<Condition[]>(sp.f, []),
    sorts: decode<Sort[]>(sp.s, []),
    groupBy: sp.group || null,
    fields: decode<string[]>(sp.cols, []),
    widths: decode<Record<string, number>>(sp.w, {}),
    rowH: (["corta", "media", "alta"] as const).includes(sp.rowh as "corta")
      ? (sp.rowh as ViewConfig["rowH"])
      : "corta",
    kanbanBy: sp.kb || "status",
    calendarBy: sp.cb || "last_activity",
    q: (sp.q ?? "").trim(),
    page: Math.max(0, Number(sp.page) || 0),
    per,
  };
}

export const ROW_HEIGHT: Record<ViewConfig["rowH"], number> = {
  corta: 40,
  media: 56,
  alta: 76,
};

/** Columna real de `contact_rows` sobre la que filtrar/ordenar. */
export function sqlColumn(key: string) {
  // PostgREST accede al JSON con custom->>clave, sin comillas.
  if (key.startsWith("custom.")) return `custom->>${key.slice(7)}`;
  return key;
}
