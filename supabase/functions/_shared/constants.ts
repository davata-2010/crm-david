/* Generado por scripts/sync-edge-shared.mjs — no editar a mano.
   Fuente: lib/constants.ts */

export const GOLD = "#FAC51C";

export const STAGES = [
  "Lead entrante",
  "Cualificado",
  "Discovery",
  "Propuesta",
  "Negociación",
  "Cerrado ganado",
  "Cerrado perdido",
] as const;

/** Etapas que siguen abiertas (entran en el pipeline). */
export const OPEN_STAGES = [0, 1, 2, 3, 4];
export const WON = 5;
export const LOST = 6;

/** Probabilidad por defecto de cada etapa (forecast ponderado). */
export const STAGE_PROBABILITY = [10, 25, 50, 65, 80, 100, 0];

export const STAGE_COLOR = [
  "#3A3A3A",
  "#4A4A4A",
  "#6E6E6E",
  "#8A8A8A",
  GOLD,
  GOLD,
  "#7A3A3A",
];

export const LOST_REASONS = [
  "Precio",
  "Sin presupuesto",
  "Eligió a un competidor",
  "Sin respuesta",
  "Mal encaje",
  "Timing",
  "Lo hacen internamente",
];

export const PROJECT_TYPES = [
  "Agentes",
  "RAG",
  "Copilotos",
  "Automatización",
  "Evals",
  "Consultoría",
  "Retainer",
];

export const ACTIVITY_KINDS = [
  "Llamada",
  "Email",
  "Reunión",
  "Documento",
  "Nota",
  "Tarea",
  "Pipeline",
  "Origen",
];

/** Tipos que representan trabajo pendiente cuando llevan vencimiento. */
export const TASK_KINDS = ["Tarea", "Llamada", "Reunión", "Email"];

export type ContactStatus = "lead" | "prospect" | "customer";

export const STATUS: Record<
  ContactStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  lead: {
    label: "Lead",
    bg: "rgba(245,245,245,0.06)",
    fg: "#C8C8C8",
    border: "rgba(245,245,245,0.14)",
  },
  prospect: {
    label: "Prospect",
    bg: "rgba(250,197,28,0.1)",
    fg: GOLD,
    border: "rgba(250,197,28,0.35)",
  },
  customer: { label: "Customer", bg: GOLD, fg: "#080808", border: GOLD },
};

export const CONTACT_STATUSES: ContactStatus[] = ["lead", "prospect", "customer"];

/** Paleta de etiquetas: color estable derivado del propio texto. */
const TAG_PALETTE = [
  { bg: "rgba(250,197,28,0.12)", fg: "#FAC51C", border: "rgba(250,197,28,0.32)" },
  { bg: "rgba(120,190,255,0.11)", fg: "#8FC7FF", border: "rgba(120,190,255,0.3)" },
  { bg: "rgba(140,230,180,0.11)", fg: "#8CE6B4", border: "rgba(140,230,180,0.3)" },
  { bg: "rgba(230,140,200,0.11)", fg: "#E68CC8", border: "rgba(230,140,200,0.3)" },
  { bg: "rgba(255,160,120,0.11)", fg: "#FFA078", border: "rgba(255,160,120,0.3)" },
  { bg: "rgba(180,160,255,0.11)", fg: "#B4A0FF", border: "rgba(180,160,255,0.3)" },
];

export function tagStyle(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

/** Estilo de chip activo/inactivo — idéntico al handoff. */
export function chip(active: boolean) {
  return active
    ? { bg: GOLD, fg: "#080808", border: GOLD }
    : { bg: "#111111", fg: "#B4B4B4", border: "rgba(245,245,245,0.1)" };
}
