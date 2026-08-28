"use client";

import { createClient } from "@/lib/supabase/client";
import type { MemberRole, Membership, Profile, Workspace } from "@/lib/types";

/**
 * La sesión, ahora en el navegador.
 *
 * Antes vivía en el servidor (`lib/workspace.ts`) y cada pantalla la pedía con
 * `await getSession()`. La aplicación compilada no tiene servidor, así que la
 * misma llamada —`app_bootstrap`, una sola ida y vuelta a Postgres— se hace
 * desde el cliente y se guarda en memoria. Las políticas RLS siguen siendo las
 * que mandan: el navegador sólo lleva la clave anónima y el JWT del usuario.
 */

export const WS_KEY = "aurum_ws";

export type Counts = {
  contacts: number;
  companies: number;
  deals: number;
  activities: number;
  tasks: number;
  overdue: number;
  trash: number;
};

export type ClientSession = {
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

/** Workspace elegido. Era una cookie; ahora vive en el propio dispositivo. */
export function wantedWorkspace(): string | null {
  try {
    return localStorage.getItem(WS_KEY);
  } catch {
    return null;
  }
}

export function setWantedWorkspace(id: string) {
  try {
    localStorage.setItem(WS_KEY, id);
  } catch {
    // Modo privado o almacenamiento bloqueado: se usará el primero que haya.
  }
}

let cached: ClientSession | null = null;
let inFlight: Promise<ClientSession | null> | null = null;

/** Vacía la copia en memoria (cerrar sesión, cambiar de workspace). */
export function clearSession() {
  cached = null;
  inFlight = null;
}

/**
 * Carga la sesión, reutilizando la copia en memoria salvo que se pida otra.
 * Devuelve `null` si no hay usuario: quien llama decide si mandar a /login.
 */
export function loadSession(force = false): Promise<ClientSession | null> {
  if (!force && cached) return Promise.resolve(cached);
  if (!force && inFlight) return inFlight;

  inFlight = (async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("app_bootstrap", { want: wantedWorkspace() });

    if (!data?.user_id) {
      cached = null;
      return null;
    }

    const session = data.workspace
      ? build(supabase, data)
      : await bootstrapFirstWorkspace(supabase, data.user_id as string, (data.email as string) ?? "");

    cached = session;
    return session;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

function build(supabase: ReturnType<typeof createClient>, data: any): ClientSession {
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
}

/** Red de seguridad: usuario autenticado que todavía no tiene workspace. */
async function bootstrapFirstWorkspace(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string
): Promise<ClientSession | null> {
  const { data: ws } = await supabase
    .from("workspaces")
    .insert({ name: "Mi agencia", created_by: userId })
    .select("*")
    .single();
  if (!ws) return null;

  await supabase.from("memberships").insert({ workspace_id: ws.id, user_id: userId, role: "owner" });

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

/**
 * La sesión para quien no puede esperar a un hook: las acciones.
 * Lanza si no hay usuario, que es justo lo que hacía el `redirect` del servidor.
 */
export async function requireSession(): Promise<ClientSession> {
  const s = await loadSession();
  if (!s) throw new Error("Sesión caducada. Vuelve a entrar.");
  return s;
}

/* ==================================================== avisos de cambio == */

const CHANGED = "aurum:changed";

/**
 * Sustituto de `revalidatePath`. Sin servidor no hay caché que invalidar, así
 * que se avisa a las pantallas montadas de que vuelvan a pedir sus datos.
 */
export function notifyChanged(reloadSession = false) {
  if (reloadSession) cached = null;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(CHANGED, { detail: { reloadSession } }));
}

export function onChanged(fn: (reloadSession: boolean) => void) {
  const handler = (e: Event) => fn(!!(e as CustomEvent).detail?.reloadSession);
  window.addEventListener(CHANGED, handler);
  return () => window.removeEventListener(CHANGED, handler);
}
