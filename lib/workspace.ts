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
 * Sesión completa en UNA sola ida y vuelta.
 *
 * No se llama a `auth.getUser()`: esa comprobación es otra petición de red a
 * Supabase. La llamada a `app_bootstrap` ya va firmada con el JWT y Postgres
 * valida la firma, así que si devuelve datos la sesión es válida — y si no,
 * no lo es. El middleware sigue refrescando el token, que es lo único que un
 * Server Component no puede hacer por sí mismo.
 *
 * Cacheada por petición: layout y página comparten el resultado.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = createClient();
  const want = cookies().get(WS_COOKIE)?.value ?? null;

  const { data } = await supabase.rpc("app_bootstrap", { want });
  if (!data?.user_id) redirect("/login");

  if (!data.workspace) {
    return bootstrapFirstWorkspace(supabase, data.user_id as string, (data.email as string) ?? "");
  }

  const role = (data.role ?? "member") as MemberRole;
  const profile = (data.profile as Profile) ?? null;

  return {
    supabase,
    userId: data.user_id as string,
    email: (data.email as string) || profile?.email || "",
    profile,
    workspace: data.workspace as Workspace,
    role,
    canWrite: role !== "viewer",
    isAdmin: role === "owner" || role === "admin",
    workspaces: (data.workspaces ?? []) as Workspace[],
    members: (data.members ?? []) as Membership[],
    counts: { ...EMPTY_COUNTS, ...(data.counts ?? {}) },
  };
});

/** Red de seguridad: usuario autenticado sin workspace todavía. */
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
