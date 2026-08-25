"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_PROBABILITY } from "@/lib/constants";
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
  const name = str(formData.get("name"));
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      owner_id: user.id,
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      role: str(formData.get("role")),
      status: str(formData.get("status")) || "lead",
      source: str(formData.get("source")),
      timezone: str(formData.get("timezone")) || "CET · Madrid",
      company_id: str(formData.get("company_id")) || null,
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

/* --------------------------------------------------------------------- deals */

export async function createDeal(formData: FormData) {
  const { supabase, user, author } = await ctx();
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as any));
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
  const stageIndex = Math.max(0, STAGES.indexOf(str(formData.get("stage")) as any));
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
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/** Movimiento de tarjeta en el kanban. Registra la actividad automáticamente. */
export async function moveDealStage(id: string, stage: number) {
  const { supabase, user, author } = await ctx();
  const { data: before } = await supabase
    .from("deals")
    .select("name, stage, contact_id")
    .eq("id", id)
    .single();
  if (!before || before.stage === stage) return {};

  const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    owner_id: user.id,
    deal_id: id,
    contact_id: before.contact_id,
    kind: "Pipeline",
    title: `Deal movido a ${STAGES[stage]}`,
    body: `Etapa actualizada desde ${STAGES[before.stage]}. Probabilidad al ${STAGE_PROBABILITY[stage]}%.`,
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

/* ---------------------------------------------------------------- actividades */

export async function addActivity(formData: FormData) {
  const { supabase, user, author } = await ctx();
  const body = str(formData.get("body"));
  const title = str(formData.get("title")) || body.slice(0, 60) || "Nota";
  const occurred = str(formData.get("occurred_at"));
  const { error } = await supabase.from("activities").insert({
    owner_id: user.id,
    contact_id: str(formData.get("contact_id")) || null,
    deal_id: str(formData.get("deal_id")) || null,
    kind: str(formData.get("kind")) || "Nota",
    title,
    body,
    author,
    occurred_at: occurred ? new Date(occurred).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: error.message };
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
