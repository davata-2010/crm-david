import type { Membership } from "@/lib/types";

/** Nombre mostrable de un miembro. Seguro de usar en componentes de cliente. */
export function memberName(members: Membership[], userId: string | null) {
  if (!userId) return "Sin asignar";
  const m = members.find((x) => x.user_id === userId);
  return m?.profile?.full_name || m?.profile?.email || "Miembro";
}
