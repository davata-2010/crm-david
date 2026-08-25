import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Membership, Profile, Workspace } from "@/lib/types";

export const WS_COOKIE = "aurum_ws";

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
};

/**
 * Sesión de trabajo: usuario, workspace activo, rol y compañeros.
 * Cacheada por petición, así que se puede llamar desde cualquier página.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membershipRows } = await supabase
    .from("memberships")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const mine = (membershipRows ?? []) as (Membership & { workspace: Workspace })[];

  if (mine.length === 0) {
    // Sin workspace todavía (usuario creado antes de la migración): se crea uno.
    const { data: ws } = await supabase
      .from("workspaces")
      .insert({ name: "Mi agencia", created_by: user.id })
      .select("*")
      .single();
    if (ws) {
      await supabase
        .from("memberships")
        .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });
      return getSessionFor(supabase, user.id, user.email!, ws as Workspace, "owner", [
        ws as Workspace,
      ]);
    }
    redirect("/login");
  }

  const wanted = cookies().get(WS_COOKIE)?.value;
  const active = mine.find((m) => m.workspace_id === wanted) ?? mine[0];

  return getSessionFor(
    supabase,
    user.id,
    user.email!,
    active.workspace,
    active.role,
    mine.map((m) => m.workspace)
  );
});

async function getSessionFor(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  workspace: Workspace,
  role: MemberRole,
  workspaces: Workspace[]
): Promise<Session> {
  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    supabase,
    userId,
    email,
    profile: (profile as Profile) ?? null,
    workspace,
    role,
    canWrite: role !== "viewer",
    isAdmin: role === "owner" || role === "admin",
    workspaces,
    members: (members ?? []) as Membership[],
  };
}

export { memberName } from "./workspace-client";
