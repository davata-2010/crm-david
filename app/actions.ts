"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_PROBABILITY, type ContactStatus } from "@/lib/constants";
import { initials } from "@/lib/format";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  const author = profile?.full_name || user.email!.split("@")[0];
  return { supabase, user, author };
}

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

/* ------------------------------------------------------------------ empresas */

export async function createCompany(formData: FormData) {
  const { supabase, user } = await ctx();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      owner_id: user.id,
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

export async function updateCompany(id: string, formData: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase
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

export async function deleteCompany(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ----------------------------------------------------------------- contactos */

export async function createContact(formData: FormData) {
  const { supabase, user, author } = await ctx();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      owner_id: user.id,
      name: str(formData.get("name")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      role: str(formData.get("role")),
      status: str(formData.get("status")) || "lead",
      source: str(formData.get("source")),
      timezone: str(formData.get("timezone")) || "CET · Madrid",
      company_id: str(formData.get("company_id")) || null,
      tags: parseTags(formData.get("tags")),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    owner_id: user.id,
    contact_id: data.id,
    kind: "Origen",
    title: "Contacto creado",
    body: str(formData.get("source")) ? `Fuente: ${str(formData.get("source"))}` : "",
    author,
  });
  revalidateAll();
  return { id: data.id };
}

export async function updateContact(id: string, formData: FormData) {
  const { supabase } = await ctx();
  const { error } = await supabase
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
      tags: parseTags(formData.get("tags")),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function deleteContact(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function duplicateContact(id: string) {
  const { supabase, user } = await ctx();
  const { data: src, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return { error: error.message };
  const { id: _id, created_at, updated_at, ...rest } = src as Record<string, unknown>;
  const { data, error: insErr } = await supabase
    .from("contacts")
    .insert({ ...rest, owner_id: user.id, name: `${src.name} (copia)` })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  revalidateAll();
  return { id: data.id };
}

/* ------------------------------------------------------- contactos: en lote */

export async function bulkDeleteContacts(ids: string[]) {
  const { supabase } = await ctx();
  if (ids.length === 0) return {};
  const { error } = await supabase.from("contacts").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkSetContactStatus(ids: string[], status: ContactStatus) {
  const { supabase } = await ctx();
  if (ids.length === 0) return {};
  const { error } = await supabase.from("contacts").update({ status }).in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkSetContactCompany(ids: string[], companyId: string | null) {
  const { supabase } = await ctx();
  if (ids.length === 0) return {};
  const { error } = await supabase
    .from("contacts")
    .update({ company_id: companyId })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function bulkTagContacts(ids: string[], tag: string, remove = false) {
  const { supabase } = await ctx();
  const clean = tag.trim();
  if (ids.length === 0 || !clean) return {};
  const { data, error } = await supabase.from("contacts").select("id, tags").in("id", ids);
  if (error) return { error: error.message };
  for (const row of data ?? []) {
    const current: string[] = row.tags ?? [];
    const next = remove
      ? current.filter((t) => t !== clean)
      : Array.from(new Set([...current, clean])).slice(0, 12);
    await supabase.from("contacts").update({ tags: next }).eq("id", row.id);
  }
  revalidateAll();
  return { count: ids.length };
}

/** Importación CSV. Crea las empresas que falten por nombre. */
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
) {
  const { supabase, user } = await ctx();
  const valid = rows.filter((r) => r.name?.trim());
  if (valid.length === 0) return { error: "No hay filas con nombre." };

  const { data: existing } = await supabase.from("companies").select("id, name");
  const byName = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const missing = Array.from(
    new Set(
      valid
        .map((r) => r.company?.trim())
        .filter((n): n is string => !!n && !byName.has(n.toLowerCase()))
        .map((n) => n)
    )
  );
  if (missing.length) {
    const { data: created, error } = await supabase
      .from("companies")
      .insert(missing.map((name) => ({ owner_id: user.id, name })))
      .select("id, name");
    if (error) return { error: error.message };
    (created ?? []).forEach((c) => byName.set(c.name.toLowerCase(), c.id));
  }

  const statuses = ["lead", "prospect", "customer"];
  const { error } = await supabase.from("contacts").insert(
    valid.map((r) => ({
      owner_id: user.id,
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

/* --------------------------------------------------------------------- deals */

export async function createDeal(formData: FormData) {
  const { supabase, user, author } = await ctx();
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as never));
  const { data, error } = await supabase
    .from("deals")
    .insert({
      owner_id: user.id,
      name: str(formData.get("name")),
      value: num(formData.get("value")),
      stage: stageIndex,
      project_type: str(formData.get("project_type")) || "Agentes",
      close_date: str(formData.get("close_date")) || null,
      notes: str(formData.get("notes")),
      company_id: str(formData.get("company_id")) || null,
      contact_id: str(formData.get("contact_id")) || null,
      tags: parseTags(formData.get("tags")),
      lost_reason: stageIndex === 6 ? str(formData.get("lost_reason")) : "",
      owner_initials: initials(author),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    owner_id: user.id,
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

export async function updateDeal(id: string, formData: FormData) {
  const { supabase } = await ctx();
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as never));
  const { error } = await supabase
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
      tags: parseTags(formData.get("tags")),
      lost_reason: stageIndex === 6 ? str(formData.get("lost_reason")) : "",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Movimiento de tarjeta en el kanban. Registra la actividad automáticamente. */
export async function moveDealStage(id: string, stage: number, lostReason?: string) {
  const { supabase, user, author } = await ctx();
  const { data: before } = await supabase
    .from("deals")
    .select("name, stage, contact_id")
    .eq("id", id)
    .single();
  if (!before || before.stage === stage) return {};

  const patch: Record<string, unknown> = { stage };
  if (stage === 6) patch.lost_reason = lostReason ?? "";

  const { error } = await supabase.from("deals").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    owner_id: user.id,
    deal_id: id,
    contact_id: before.contact_id,
    kind: "Pipeline",
    title: `Deal movido a ${STAGES[stage]}`,
    body:
      stage === 6 && lostReason
        ? `Etapa actualizada desde ${STAGES[before.stage]}. Motivo: ${lostReason}.`
        : `Etapa actualizada desde ${STAGES[before.stage]}. Probabilidad al ${STAGE_PROBABILITY[stage]}%.`,
    author,
  });
  revalidateAll();
  return {};
}

export async function deleteDeal(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function bulkDeleteDeals(ids: string[]) {
  const { supabase } = await ctx();
  if (ids.length === 0) return {};
  const { error } = await supabase.from("deals").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

export async function duplicateDeal(id: string) {
  const { supabase, user } = await ctx();
  const { data: src, error } = await supabase.from("deals").select("*").eq("id", id).single();
  if (error) return { error: error.message };
  const { id: _id, created_at, updated_at, closed_at, ...rest } = src as Record<string, unknown>;
  const { data, error: insErr } = await supabase
    .from("deals")
    .insert({ ...rest, owner_id: user.id, name: `${src.name} (copia)`, stage: 0 })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  revalidateAll();
  return { id: data.id };
}

/* ---------------------------------------------------------------- actividades */

export async function addActivity(formData: FormData) {
  const { supabase, user, author } = await ctx();
  const body = str(formData.get("body"));
  const title = str(formData.get("title")) || body.slice(0, 60) || "Nota";
  const occurred = str(formData.get("occurred_at"));
  const due = str(formData.get("due_date"));
  const { error } = await supabase.from("activities").insert({
    owner_id: user.id,
    contact_id: str(formData.get("contact_id")) || null,
    deal_id: str(formData.get("deal_id")) || null,
    kind: str(formData.get("kind")) || "Nota",
    title,
    body,
    author,
    due_date: due ? new Date(due).toISOString() : null,
    occurred_at: occurred ? new Date(occurred).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function toggleActivityCompleted(id: string, completed: boolean) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("activities").update({ completed }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function snoozeActivity(id: string, days: number) {
  const { supabase } = await ctx();
  const { data: row, error } = await supabase
    .from("activities")
    .select("due_date")
    .eq("id", id)
    .single();
  if (error) return { error: error.message };
  const base = row.due_date ? new Date(row.due_date) : new Date();
  base.setDate(base.getDate() + days);
  const { error: upErr } = await supabase
    .from("activities")
    .update({ due_date: base.toISOString() })
    .eq("id", id);
  if (upErr) return { error: upErr.message };
  revalidateAll();
  return {};
}

export async function deleteActivity(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function bulkDeleteActivities(ids: string[]) {
  const { supabase } = await ctx();
  if (ids.length === 0) return {};
  const { error } = await supabase.from("activities").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidateAll();
  return { count: ids.length };
}

/* -------------------------------------------------------------------- perfil */

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await ctx();
  const prefs = {
    digest: formData.get("digest") === "on",
    mentions: formData.get("mentions") === "on",
    autoLog: formData.get("autoLog") === "on",
    weighted: formData.get("weighted") === "on",
  };
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: str(formData.get("full_name")),
    role: str(formData.get("role")),
    email: str(formData.get("email")) || user.email!,
    phone: str(formData.get("phone")),
    prefs,
  });
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Borra todos los datos del workspace (no la cuenta). */
export async function wipeWorkspace() {
  const { supabase, user } = await ctx();
  for (const table of ["activities", "deals", "contacts", "companies"]) {
    const { error } = await supabase.from(table).delete().eq("owner_id", user.id);
    if (error) return { error: error.message };
  }
  revalidateAll();
  return {};
}
