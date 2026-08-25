export const GOLD = "#FAC51C";

export const STAGES = [
  "Lead entrante",
  "Cualificado",
  "Discovery",
  "Propuesta",
  "Negociación",
  "Cerrado ganado",
] as const;

/** Probabilidad por defecto de cada etapa (forecast ponderado). */
export const STAGE_PROBABILITY = [10, 25, 50, 65, 80, 100];

export const PROJECT_TYPES = [
  "Agentes",
  "RAG",
  "Copilotos",
  "Automatización",
  "Evals",
];

export const ACTIVITY_KINDS = [
  "Llamada",
  "Email",
  "Reunión",
  "Documento",
  "Nota",
  "Pipeline",
  "Origen",
];

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

/** Estilo de chip activo/inactivo — idéntico al handoff. */
export function chip(active: boolean) {
  return active
    ? { bg: GOLD, fg: "#080808", border: GOLD }
    : { bg: "#111111", fg: "#B4B4B4", border: "rgba(245,245,245,0.1)" };
}
