/* Generado por scripts/sync-edge-shared.mjs — no editar a mano.
   Fuente: lib/format.ts */

export const eur = (n: number) =>
  "€" + Math.round(n || 0).toLocaleString("es-ES");

/** €1,24M / €96.000 — formato compacto para los KPI del dashboard. */
export function eurCompact(n: number) {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000)
    return "€" + (v / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "M";
  if (Math.abs(v) >= 10_000)
    return "€" + Math.round(v / 1000).toLocaleString("es-ES") + "k";
  return eur(v);
}

export const initials = (name: string) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "30 sep" */
export function shortDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export const monthLabel = (d: Date) => MONTHS[d.getMonth()];

/** "hoy" · "ayer" · "hace 5 días" · "hace 2 semanas" */
export function relative(iso?: string | null) {
  if (!iso) return "sin actividad";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "sin actividad";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 14) return "hace 1 semana";
  if (days < 31) return `hace ${Math.floor(days / 7)} semanas`;
  if (days < 62) return "hace 1 mes";
  return `hace ${Math.floor(days / 30)} meses`;
}

/** "hoy · 10:20" / "21 ago" para el timeline. */
export function timelineWhen(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const hhmm = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (days <= 0) return `hoy · ${hhmm}`;
  if (days === 1) return `ayer · ${hhmm}`;
  return shortDate(iso);
}

export const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
