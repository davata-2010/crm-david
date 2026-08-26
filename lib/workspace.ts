import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Membership, Profile, Workspace } from "@/lib/types";

export const WS_COOKIE = "aurum_ws";

export type Counts = {
  contacts: number;
  companies: number;
  deals: number;
  activities: number;
  tasks: number;
  overdue: number;
  trash: number;
};

export type Session = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  email: string;
  profile: Profile | null;
  workspace: Workspace;
  role: MemberRole;
  canWrite: boolean;
  isAdmin: boolean;
  workspaces: Workspace[];
  members: Membership[];
  counts: Counts;
};

const EMPTY_COUNTS: Counts = {
  contacts: 0,
  companies: 0,
  deals: 0,
  activities: 0,
  tasks: 0,
  overdue: 0,
  trash: 0,
};

/**
 * Sesión de trabajo completa en UNA sola llamada a la base de datos.
 *
 * Antes eran cuatro consultas encadenadas más siete contadores; con Supabase
 * en Irlanda y las funciones en Ohio, cada una costaba un viaje transatlántico.
 * `app_bootstrap` devuelve workspace, rol, perfil, compañeros y contadores de
 * golpe. Cacheada por petición: se puede llamar desde el layout y la página.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const want = cookies().get(WS_COOKIE)?.value ?? null;
  const { data } = await supabase.rpc("app_bootstrap", { want });

  if (!data?.workspace) return bootstrapFirstWorkspace(supabase, user.id, user.email!);

  const role = (data.role ?? "member") as MemberRole;

  return {
    supabase,
    userId: user.id,
    email: user.email!,
    profile: (data.profile as Profile) ?? null,
    workspace: data.workspace as Workspace,
    role,
    canWrite: role !== "viewer",
    isAdmin: role === "owner" || role === "admin",
    workspaces: (data.workspaces ?? []) as Workspace[],
    members: (data.members ?? []) as Membership[],
    counts: { ...EMPTY_COUNTS, ...(data.counts ?? {}) },
  };
});

/** Red de seguridad: usuario sin workspace (cuenta anterior a la migración). */
async function bootstrapFirstWorkspace(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string
): Promise<Session> {
  const { data: ws } = await supabase
    .from("workspaces")
    .insert({ name: "Mi agencia", created_by: userId })
    .select("*")
    .single();

  if (!ws) redirect("/login");

  await supabase
    .from("memberships")
    .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });

  return {
    supabase,
    userId,
    email,
    profile: null,
    workspace: ws as Workspace,
    role: "owner",
    canWrite: true,
    isAdmin: true,
    workspaces: [ws as Workspace],
    members: [],
    counts: EMPTY_COUNTS,
  };
}

export { memberName } from "./workspace-client";
