"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSession, WS_COOKIE } from "@/lib/workspace";
import { STAGES, STAGE_PROBABILITY, type ContactStatus } from "@/lib/constants";
import { initials } from "@/lib/format";
import type { MemberRole } from "@/lib/types";

type Result = { error?: string; id?: string; count?: number; ok?: boolean };

function revalidateAll() {
  revalidatePath("/", "layout");
}

const num = (v: FormDataEntryValue | null) =>
  Number(String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

const parseTags = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

/** Campos personalizados: llegan como custom__<key> en el FormData. */
function parseCustom(formData: FormData) {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (key.startsWith("custom__")) out[key.slice(8)] = String(value);
  });
  return out;
}

async function guard() {
  const s = await getSession();
  if (!s.canWrite) throw new Error("Tu rol es de sólo lectura.");
  return s;
}

/* ============================================================ workspace */

export async function switchWorkspace(workspaceId: string): Promise<Result> {
  const s = await getSession();
  if (!s.workspaces.some((w) => w.id === workspaceId))
    return { error: "No perteneces a ese workspace." };
  cookies().set(WS_COOKIE, workspaceId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidateAll();
  return { ok: true };
}

export async function renameWorkspace(name: string): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede renombrar el workspace." };
  const { error } = await s.supabase
    .from("workspaces")
    .update({ name: name.trim() || "Mi agencia" })
    .eq("id", s.workspace.id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function regenerateApiKey(): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede rotar la clave." };
  const key = "aur_live_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
  const { error } = await s.supabase
    .from("workspaces")
    .update({ api_key: key })
    .eq("id", s.workspace.id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* =============================================================== equipo */

export async function inviteMember(email: string, role: MemberRole): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede invitar." };
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Email no válido." };

  const { data, error } = await s.supabase
    .from("invitations")
    .insert({
      workspace_id: s.workspace.id,
      email: clean,
      role,
      invited_by: s.userId,
    })
    .select("token")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.token };
}

export async function revokeInvitation(id: string): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede revocar invitaciones." };
  const { error } = await s.supabase.from("invitations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function changeMemberRole(userId: string, role: MemberRole): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede cambiar roles." };
  if (userId === s.userId) return { error: "No puedes cambiar tu propio rol." };
  const { error } = await s.supabase
    .from("memberships")
    .update({ role })
    .eq("workspace_id", s.workspace.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function removeMember(userId: string): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede quitar miembros." };
  if (userId === s.userId) return { error: "No puedes quitarte a ti mismo." };
  const { error } = await s.supabase
    .from("memberships")
    .delete()
    .eq("workspace_id", s.workspace.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Acepta una invitación pendiente para el email de la sesión actual. */
export async function acceptInvitation(token: string): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión para aceptar la invitación." };

  const { data: inv } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!inv) return { error: "La invitación no existe o ya se usó." };
  if (inv.accepted_at) return { error: "Esa invitación ya se había aceptado." };
  if (inv.email.toLowerCase() !== user.email!.toLowerCase())
    return { error: `Esta invitación es para ${inv.email}.` };

  const { error } = await supabase
    .from("memberships")
    .insert({ workspace_id: inv.workspace_id, user_id: user.id, role: inv.role });
  if (error && !error.message.includes("duplicate")) return { error: error.message };

  await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  cookies().set(WS_COOKIE, inv.workspace_id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidateAll();
  return { ok: true };
}

/* ============================================================= empresas */

export async function createCompany(formData: FormData): Promise<Result> {
  const s = await guard();
  const { data, error } = await s.supabase
    .from("companies")
    .insert({
      workspace_id: s.workspace.id,
      owner_id: s.userId,
      name: str(formData.get("name")),
      industry: str(formData.get("industry")),
      website: str(formData.get("website")),
      country: str(formData.get("country")),
      size: str(formData.get("size")),
      notes: str(formData.get("notes")),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}

export async function updateCompany(id: string, formData: FormData): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase
    .from("companies")
    .update({
      name: str(formData.get("name")),
      industry: str(formData.get("industry")),
      website: str(formData.get("website")),
      country: str(formData.get("country")),
      size: str(formData.get("size")),
      notes: str(formData.get("notes")),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ============================================================ contactos */

export async function createContact(formData: FormData): Promise<Result> {
  const s = await guard();
  const { data, error } = await s.supabase
    .from("contacts")
    .insert({
      workspace_id: s.workspace.id,
      owner_id: s.userId,
      assigned_to: str(formData.get("assigned_to")) || s.userId,
      name: str(formData.get("name")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      role: str(formData.get("role")),
      status: str(formData.get("status")) || "lead",
      source: str(formData.get("source")),
      timezone: str(formData.get("timezone")) || "CET · Madrid",
      company_id: str(formData.get("company_id")) || null,
      tags: parseTags(formData.get("tags")),
      custom: parseCustom(formData),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await s.supabase.from("activities").insert({
    workspace_id: s.workspace.id,
    owner_id: s.userId,
    contact_id: data.id,
    kind: "Origen",
    title: "Contacto creado",
    body: str(formData.get("source")) ? `Fuente: ${str(formData.get("source"))}` : "",
    author: s.profile?.full_name || s.email,
  });
  revalidateAll();
  return { id: data.id };
}

export async function updateContact(id: string, formData: FormData): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase
    .from("contacts")
    .update({
      name: str(formData.get("name")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      role: str(formData.get("role")),
      status: str(formData.get("status")),
      source: str(formData.get("source")),
      timezone: str(formData.get("timezone")),
      company_id: str(formData.get("company_id")) || null,
      assigned_to: str(formData.get("assigned_to")) || null,
      tags: parseTags(formData.get("tags")),
      custom: parseCustom(formData),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function duplicateContact(id: string): Promise<Result> {
  const s = await guard();
  const { data: src, error } = await s.supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return { error: error.message };
  const copy = { ...(src as Record<string, unknown>) };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  const { data, error: insErr } = await s.supabase
    .from("contacts")
    .insert({ ...copy, owner_id: s.userId, name: `${src.name} (copia)` })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  revalidateAll();
  return { id: data.id };
}

/** Fusiona duplicados: mueve deals, actividades y adjuntos al superviviente. */
export async function mergeContacts(keepId: string, mergeIds: string[]): Promise<Result> {
  const s = await guard();
  const ids = mergeIds.filter((i) => i !== keepId);
  if (ids.length === 0) return { error: "Nada que fusionar." };

  const { data: rows, error } = await s.supabase
    .from("contacts")
    .select("*")
    .in("id", [keepId, ...ids]);
  if (error) return { error: error.message };

  const keep = rows!.find((r) => r.id === keepId);
  const others = rows!.filter((r) => r.id !== keepId);
  if (!keep) return { error: "El contacto principal no existe." };

  // Rellena huecos del superviviente con datos de los duplicados.
  const patch: Record<string, unknown> = {};
  for (const field of ["email", "phone", "role", "source", "timezone", "company_id"]) {
    if (!keep[field]) {
      const found = others.find((o) => o[field]);
      if (found) patch[field] = found[field];
    }
  }
  const tags = new Set<string>(keep.tags ?? []);
  others.forEach((o) => (o.tags ?? []).forEach((t: string) => tags.add(t)));
  patch.tags = Array.from(tags).slice(0, 12);
  patch.custom = others.reduce((acc, o) => ({ ...o.custom, ...acc }), keep.custom ?? {});

  await s.supabase.from("deals").update({ contact_id: keepId }).in("contact_id", ids);
  await s.supabase.from("activities").update({ contact_id: keepId }).in("contact_id", ids);
  await s.supabase.from("attachments").update({ contact_id: keepId }).in("contact_id", ids);
  await s.supabase.from("contacts").update(patch).eq("id", keepId);

  const { error: delErr } = await s.supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (delErr) return { error: delErr.message };

  await s.supabase.from("activities").insert({
    workspace_id: s.workspace.id,
    owner_id: s.userId,
    contact_id: keepId,
    kind: "Nota",
    title: `Fusionados ${ids.length} duplicados`,
    body: others.map((o) => o.name).join(", "),
    author: s.profile?.full_name || s.email,
  });

  revalidateAll();
  return { count: ids.length };
}

/* ------------------------------------------------------- lote contactos */

export async function bulkSetContactStatus(ids: string[], status: ContactStatus): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  const { error } = await s.supabase.from("contacts").update({ status }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkSetContactCompany(ids: string[], companyId: string | null): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  const { error } = await s.supabase.from("contacts").update({ company_id: companyId }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkAssignContacts(ids: string[], userId: string | null): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  const { error } = await s.supabase.from("contacts").update({ assigned_to: userId }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkTagContacts(ids: string[], tag: string, remove = false): Promise<Result> {
  const s = await guard();
  const clean = tag.trim();
  if (!ids.length || !clean) return {};
  const { data, error } = await s.supabase.from("contacts").select("id, tags").in("id", ids);
  if (error) return { error: error.message };
  for (const row of data ?? []) {
    const current: string[] = row.tags ?? [];
    const next = remove
      ? current.filter((t) => t !== clean)
      : Array.from(new Set([...current, clean])).slice(0, 12);
    await s.supabase.from("contacts").update({ tags: next }).eq("id", row.id);
  }
  revalidateAll();
  return { count: ids.length };
}

export async function importContacts(
  rows: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    company?: string;
    status?: string;
    tags?: string;
  }[]
): Promise<Result> {
  const s = await guard();
  const valid = rows.filter((r) => r.name?.trim());
  if (!valid.length) return { error: "No hay filas con nombre." };

  const { data: existing } = await s.supabase
    .from("companies")
    .select("id, name")
    .is("deleted_at", null);
  const byName = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const missing = Array.from(
    new Set(
      valid
        .map((r) => r.company?.trim())
        .filter((n): n is string => !!n && !byName.has(n.toLowerCase()))
    )
  );
  if (missing.length) {
    const { data: created, error } = await s.supabase
      .from("companies")
      .insert(
        missing.map((name) => ({ workspace_id: s.workspace.id, owner_id: s.userId, name }))
      )
      .select("id, name");
    if (error) return { error: error.message };
    (created ?? []).forEach((c) => byName.set(c.name.toLowerCase(), c.id));
  }

  const statuses = ["lead", "prospect", "customer"];
  const { error } = await s.supabase.from("contacts").insert(
    valid.map((r) => ({
      workspace_id: s.workspace.id,
      owner_id: s.userId,
      assigned_to: s.userId,
      name: r.name.trim(),
      email: r.email?.trim() ?? "",
      phone: r.phone?.trim() ?? "",
      role: r.role?.trim() ?? "",
      status: statuses.includes(String(r.status).trim()) ? String(r.status).trim() : "lead",
      company_id: r.company?.trim() ? byName.get(r.company.trim().toLowerCase()) ?? null : null,
      tags: (r.tags ?? "")
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12),
    }))
  );
  if (error) return { error: error.message };
  revalidateAll();
  return { count: valid.length };
}

/* ================================================================ deals */

export async function createDeal(formData: FormData): Promise<Result> {
  const s = await guard();
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as never));
  const author = s.profile?.full_name || s.email;
  const { data, error } = await s.supabase
    .from("deals")
    .insert({
      workspace_id: s.workspace.id,
      owner_id: s.userId,
      assigned_to: str(formData.get("assigned_to")) || s.userId,
      name: str(formData.get("name")),
      value: num(formData.get("value")),
      stage: stageIndex,
      project_type: str(formData.get("project_type")) || "Agentes",
      close_date: str(formData.get("close_date")) || null,
      notes: str(formData.get("notes")),
      company_id: str(formData.get("company_id")) || null,
      contact_id: str(formData.get("contact_id")) || null,
      tags: parseTags(formData.get("tags")),
      custom: parseCustom(formData),
      lost_reason: stageIndex === 6 ? str(formData.get("lost_reason")) : "",
      owner_initials: initials(author),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await s.supabase.from("activities").insert({
    workspace_id: s.workspace.id,
    owner_id: s.userId,
    deal_id: data.id,
    contact_id: str(formData.get("contact_id")) || null,
    kind: "Pipeline",
    title: "Deal creado",
    body: `${str(formData.get("name"))} en ${STAGES[stageIndex]}.`,
    author,
  });
  revalidateAll();
  return { id: data.id };
}

export async function updateDeal(id: string, formData: FormData): Promise<Result> {
  const s = await guard();
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as never));
  const { error } = await s.supabase
    .from("deals")
    .update({
      name: str(formData.get("name")),
      value: num(formData.get("value")),
      stage: stageIndex,
      project_type: str(formData.get("project_type")),
      close_date: str(formData.get("close_date")) || null,
      notes: str(formData.get("notes")),
      company_id: str(formData.get("company_id")) || null,
      contact_id: str(formData.get("contact_id")) || null,
      assigned_to: str(formData.get("assigned_to")) || null,
      tags: parseTags(formData.get("tags")),
      custom: parseCustom(formData),
      lost_reason: stageIndex === 6 ? str(formData.get("lost_reason")) : "",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function moveDealStage(id: string, stage: number, lostReason?: string): Promise<Result> {
  const s = await guard();
  const { data: before } = await s.supabase
    .from("deals")
    .select("name, stage, contact_id")
    .eq("id", id)
    .single();
  if (!before || before.stage === stage) return {};

  const patch: Record<string, unknown> = { stage };
  if (stage === 6) patch.lost_reason = lostReason ?? "";

  const { error } = await s.supabase.from("deals").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await s.supabase.from("activities").insert({
    workspace_id: s.workspace.id,
    owner_id: s.userId,
    deal_id: id,
    contact_id: before.contact_id,
    kind: "Pipeline",
    title: `Deal movido a ${STAGES[stage]}`,
    body:
      stage === 6 && lostReason
        ? `Etapa actualizada desde ${STAGES[before.stage]}. Motivo: ${lostReason}.`
        : `Etapa actualizada desde ${STAGES[before.stage]}. Probabilidad al ${STAGE_PROBABILITY[stage]}%.`,
    author: s.profile?.full_name || s.email,
  });
  revalidateAll();
  return {};
}

export async function bulkAssignDeals(ids: string[], userId: string | null): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  const { error } = await s.supabase.from("deals").update({ assigned_to: userId }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function duplicateDeal(id: string): Promise<Result> {
  const s = await guard();
  const { data: src, error } = await s.supabase.from("deals").select("*").eq("id", id).single();
  if (error) return { error: error.message };
  const copy = { ...(src as Record<string, unknown>) };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.closed_at;
  const { data, error: insErr } = await s.supabase
    .from("deals")
    .insert({ ...copy, owner_id: s.userId, name: `${src.name} (copia)`, stage: 0 })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  revalidateAll();
  return { id: data.id };
}

/* ========================================================== actividades */

export async function addActivity(formData: FormData): Promise<Result> {
  const s = await guard();
  const body = str(formData.get("body"));
  const title = str(formData.get("title")) || body.slice(0, 60) || "Nota";
  const occurred = str(formData.get("occurred_at"));
  const due = str(formData.get("due_date"));
  const { error } = await s.supabase.from("activities").insert({
    workspace_id: s.workspace.id,
    owner_id: s.userId,
    contact_id: str(formData.get("contact_id")) || null,
    deal_id: str(formData.get("deal_id")) || null,
    kind: str(formData.get("kind")) || "Nota",
    title,
    body,
    author: s.profile?.full_name || s.email,
    due_date: due ? new Date(due).toISOString() : null,
    occurred_at: occurred ? new Date(occurred).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function toggleActivityCompleted(id: string, completed: boolean): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("activities").update({ completed }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function snoozeActivity(id: string, days: number): Promise<Result> {
  const s = await guard();
  const { data: row, error } = await s.supabase
    .from("activities")
    .select("due_date")
    .eq("id", id)
    .single();
  if (error) return { error: error.message };
  const base = row.due_date ? new Date(row.due_date) : new Date();
  base.setDate(base.getDate() + days);
  const { error: upErr } = await s.supabase
    .from("activities")
    .update({ due_date: base.toISOString() })
    .eq("id", id);
  if (upErr) return { error: upErr.message };
  revalidateAll();
  return {};
}

/* ====================================== papelera: borrar, restaurar, purgar */

const TRASHABLE = ["contacts", "companies", "deals", "activities"] as const;
export type Trashable = (typeof TRASHABLE)[number];

export async function softDelete(entity: Trashable, ids: string[]): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  if (!TRASHABLE.includes(entity)) return { error: "Entidad no válida." };
  const { error } = await s.supabase
    .from(entity)
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function restore(entity: Trashable, ids: string[]): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  if (!TRASHABLE.includes(entity)) return { error: "Entidad no válida." };
  const { error } = await s.supabase.from(entity).update({ deleted_at: null }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function purge(entity: Trashable, ids: string[]): Promise<Result> {
  const s = await guard();
  if (!ids.length) return {};
  if (!TRASHABLE.includes(entity)) return { error: "Entidad no válida." };
  const { error } = await s.supabase
    .from(entity)
    .delete()
    .in("id", ids)
    .not("deleted_at", "is", null);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function emptyTrash(): Promise<Result> {
  const s = await guard();
  if (!s.isAdmin) return { error: "Sólo un administrador puede vaciar la papelera." };
  for (const entity of TRASHABLE) {
    const { error } = await s.supabase
      .from(entity)
      .delete()
      .eq("workspace_id", s.workspace.id)
      .not("deleted_at", "is", null);
    if (error) return { error: error.message };
  }
  revalidateAll();
  return {};
}

/* ======================================================== vistas guardadas */

export async function saveView(
  entity: string,
  name: string,
  config: Record<string, string>,
  shared: boolean
): Promise<Result> {
  const s = await guard();
  if (!name.trim()) return { error: "Ponle un nombre a la vista." };
  const { data, error } = await s.supabase
    .from("saved_views")
    .insert({
      workspace_id: s.workspace.id,
      user_id: s.userId,
      entity,
      name: name.trim(),
      config,
      shared,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}

export async function deleteView(id: string): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("saved_views").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ==================================================== campos personalizados */

export async function createCustomField(formData: FormData): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede crear campos." };
  const label = str(formData.get("label"));
  if (!label) return { error: "El campo necesita un nombre." };
  const key =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "campo";

  const { error } = await s.supabase.from("custom_fields").insert({
    workspace_id: s.workspace.id,
    entity: str(formData.get("entity")) === "deals" ? "deals" : "contacts",
    key,
    label,
    type: str(formData.get("type")) || "text",
    options: str(formData.get("options"))
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function deleteCustomField(id: string): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede borrar campos." };
  const { error } = await s.supabase.from("custom_fields").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ================================================================ adjuntos */

export async function registerAttachment(
  path: string,
  name: string,
  size: number,
  mime: string,
  contactId?: string,
  dealId?: string
): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("attachments").insert({
    workspace_id: s.workspace.id,
    contact_id: contactId ?? null,
    deal_id: dealId ?? null,
    name,
    path,
    size,
    mime,
    uploaded_by: s.userId,
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function deleteAttachment(id: string, path: string): Promise<Result> {
  const s = await guard();
  await s.supabase.storage.from("attachments").remove([path]);
  const { error } = await s.supabase.from("attachments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ================================================================== perfil */

export async function updateProfile(formData: FormData): Promise<Result> {
  const s = await getSession();
  const prefs = {
    digest: formData.get("digest") === "on",
    mentions: formData.get("mentions") === "on",
    autoLog: formData.get("autoLog") === "on",
    weighted: formData.get("weighted") === "on",
  };
  const { error } = await s.supabase.from("profiles").upsert({
    id: s.userId,
    full_name: str(formData.get("full_name")),
    role: str(formData.get("role")),
    email: str(formData.get("email")) || s.email,
    phone: str(formData.get("phone")),
    prefs,
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function wipeWorkspace(): Promise<Result> {
  const s = await getSession();
  if (!s.isAdmin) return { error: "Sólo un administrador puede vaciar el workspace." };
  for (const table of ["activities", "deals", "contacts", "companies"]) {
    const { error } = await s.supabase
      .from(table)
      .delete()
      .eq("workspace_id", s.workspace.id);
    if (error) return { error: error.message };
  }
  revalidateAll();
  return {};
}

/* ------------------------------------------------------------------------
 * Atajos con nombre por entidad. Todos pasan por la papelera: nada se borra
 * de verdad hasta que se purga desde /trash.
 * --------------------------------------------------------------------- */

export async function deleteContact(id: string) {
  return softDelete("contacts", [id]);
}
export async function bulkDeleteContacts(ids: string[]) {
  return softDelete("contacts", ids);
}
export async function deleteCompany(id: string) {
  return softDelete("companies", [id]);
}
export async function deleteDeal(id: string) {
  return softDelete("deals", [id]);
}
export async function bulkDeleteDeals(ids: string[]) {
  return softDelete("deals", ids);
}
export async function deleteActivity(id: string) {
  return softDelete("activities", [id]);
}
export async function bulkDeleteActivities(ids: string[]) {
  return softDelete("activities", ids);
}

/* ==================================================== edición en celda ==== */

const CELL_WRITABLE = new Set([
  "name",
  "email",
  "phone",
  "role",
  "status",
  "source",
  "timezone",
  "company_id",
  "assigned_to",
  "tags",
]);

/**
 * Edición directa desde la cuadrícula. Una celda, un valor.
 * `key` puede ser una columna o `custom.<clave>` para un campo personalizado.
 */
export async function updateContactField(
  id: string,
  key: string,
  value: string | string[] | null
): Promise<Result> {
  const s = await guard();

  if (key.startsWith("custom.")) {
    const field = key.slice(7);
    const { data: row, error: readErr } = await s.supabase
      .from("contacts")
      .select("custom")
      .eq("id", id)
      .single();
    if (readErr) return { error: readErr.message };
    const custom = { ...((row.custom ?? {}) as Record<string, unknown>) };
    if (value === null || value === "") delete custom[field];
    else custom[field] = value;
    const { error } = await s.supabase.from("contacts").update({ custom }).eq("id", id);
    if (error) return { error: error.message };
    revalidateAll();
    return {};
  }

  if (!CELL_WRITABLE.has(key)) return { error: `El campo "${key}" no es editable.` };

  let next: string | string[] | null = value;
  if (key === "tags") {
    next = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 12);
  } else if (key === "company_id" || key === "assigned_to") {
    next = value ? String(value) : null;
  } else if (key === "status") {
    const allowed = ["lead", "prospect", "customer"];
    if (!allowed.includes(String(value))) return { error: "Estado no válido." };
  } else {
    next = String(value ?? "");
  }

  const { error } = await s.supabase
    .from("contacts")
    .update({ [key]: next })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Alta rápida desde la última fila de la cuadrícula. */
export async function quickCreateContact(name: string): Promise<Result> {
  const s = await guard();
  const clean = name.trim();
  if (!clean) return { error: "Escribe un nombre." };
  const { data, error } = await s.supabase
    .from("contacts")
    .insert({
      workspace_id: s.workspace.id,
      owner_id: s.userId,
      assigned_to: s.userId,
      name: clean,
      status: "lead",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}

export async function updateSavedView(
  id: string,
  config: Record<string, string>
): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("saved_views").update({ config }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ============================== edición en celda: empresas y deals ==== */

const WRITABLE: Record<string, Set<string>> = {
  contacts: new Set([
    "name", "email", "phone", "role", "status", "source", "timezone",
    "company_id", "assigned_to", "tags",
  ]),
  companies: new Set(["name", "industry", "website", "country", "size", "notes"]),
  deals: new Set([
    "name", "value", "stage", "project_type", "close_date", "notes",
    "company_id", "contact_id", "assigned_to", "tags", "lost_reason",
  ]),
};

const NUMERIC = new Set(["value"]);
const INTEGER = new Set(["stage"]);

/**
 * Edición de una celda en cualquiera de las tres cuadrículas.
 * Mover un deal de etapa desde aquí registra la actividad, igual que el kanban.
 */
export async function updateRecordField(
  entity: "contacts" | "companies" | "deals",
  id: string,
  key: string,
  value: string | string[] | null
): Promise<Result> {
  const s = await guard();
  const allow = WRITABLE[entity];
  if (!allow) return { error: "Entidad no válida." };

  if (key.startsWith("custom.")) {
    if (entity === "companies") return { error: "Las empresas no tienen campos personalizados." };
    const field = key.slice(7);
    const { data: row, error: readErr } = await s.supabase
      .from(entity)
      .select("custom")
      .eq("id", id)
      .single();
    if (readErr) return { error: readErr.message };
    const custom = { ...((row.custom ?? {}) as Record<string, unknown>) };
    if (value === null || value === "") delete custom[field];
    else custom[field] = value;
    const { error } = await s.supabase.from(entity).update({ custom }).eq("id", id);
    if (error) return { error: error.message };
    revalidateAll();
    return {};
  }

  if (!allow.has(key)) return { error: `El campo "${key}" no es editable.` };

  // Cambiar de etapa pasa por moveDealStage para que quede en el timeline.
  if (entity === "deals" && key === "stage") {
    const stage = Number(value);
    if (!Number.isInteger(stage) || stage < 0 || stage > 6) return { error: "Etapa no válida." };
    return moveDealStage(id, stage);
  }

  let next: unknown = value;
  if (key === "tags") {
    next = Array.isArray(value)
      ? value
      : String(value ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
  } else if (key === "company_id" || key === "contact_id" || key === "assigned_to") {
    next = value ? String(value) : null;
  } else if (key === "close_date") {
    next = value ? String(value) : null;
  } else if (NUMERIC.has(key)) {
    next = Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
  } else if (INTEGER.has(key)) {
    next = parseInt(String(value ?? "0"), 10) || 0;
  } else if (key === "status") {
    if (!["lead", "prospect", "customer"].includes(String(value)))
      return { error: "Estado no válido." };
  } else {
    next = String(value ?? "");
  }

  const { error } = await s.supabase.from(entity).update({ [key]: next }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Alta rápida desde la última fila, para empresas y deals. */
export async function quickCreateRecord(
  entity: "companies" | "deals",
  name: string
): Promise<Result> {
  const s = await guard();
  const clean = name.trim();
  if (!clean) return { error: "Escribe un nombre." };

  const base: Record<string, unknown> =
    entity === "companies"
      ? { workspace_id: s.workspace.id, owner_id: s.userId, name: clean }
      : {
          workspace_id: s.workspace.id,
          owner_id: s.userId,
          assigned_to: s.userId,
          name: clean,
          value: 0,
          stage: 0,
          project_type: "Agentes",
          owner_initials: initials(s.profile?.full_name || s.email),
        };

  const { data, error } = await s.supabase.from(entity).insert(base).select("id").single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}
