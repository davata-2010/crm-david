"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/workspace";
import type { Condition } from "@/lib/fields";
import type { Step, TriggerKey } from "@/lib/workflows";

type Result = { error?: string; id?: string };

async function guard() {
  const s = await getSession();
  if (!s.canWrite) throw new Error("Tu rol es de sólo lectura.");
  return s;
}

const revalidateAll = () => revalidatePath("/", "layout");

/* ==================================================== automatizaciones == */

export async function createWorkflow(): Promise<Result> {
  const s = await guard();
  const { data, error } = await s.supabase
    .from("workflows")
    .insert({
      workspace_id: s.workspace.id,
      name: "Automatización sin título",
      trigger: "contact.created",
      created_by: s.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}

export async function saveWorkflow(
  id: string,
  patch: {
    name: string;
    description: string;
    trigger: TriggerKey;
    trigger_config: Record<string, string>;
    conditions: Condition[];
    steps: Step[];
    active: boolean;
  }
): Promise<Result> {
  const s = await guard();
  if (!patch.name.trim()) return { error: "Ponle un nombre." };
  if (patch.active && patch.steps.length === 0)
    return { error: "No puedes activar una automatización sin pasos." };

  const bad = patch.steps.find(
    (st) => st.type === "webhook" && !/^https?:\/\/.+/.test(st.url)
  );
  if (bad) return { error: "La URL del webhook no es válida." };

  const { error } = await s.supabase.from("workflows").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function toggleWorkflow(id: string, active: boolean): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("workflows").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

export async function deleteWorkflow(id: string): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("workflows").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

/* ========================================================= formularios == */

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "formulario";

export async function createForm(): Promise<Result> {
  const s = await guard();
  const base = slugify(`${s.workspace.name}-contacto`);
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await s.supabase
    .from("forms")
    .insert({
      workspace_id: s.workspace.id,
      name: "Formulario de contacto",
      slug,
      title: "Hablemos",
      description: "Cuéntanos qué necesitas y te respondemos en 24 horas.",
      fields: [
        { key: "name", label: "Nombre", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "company", label: "Empresa", type: "text", required: false },
        { key: "message", label: "¿Qué necesitas?", type: "textarea", required: false },
      ],
      created_by: s.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAll();
  return { id: data.id };
}

export async function saveForm(
  id: string,
  patch: {
    name: string;
    slug: string;
    title: string;
    description: string;
    fields: { key: string; label: string; type: string; required: boolean }[];
    submit_label: string;
    success_message: string;
    redirect_url: string;
    tags: string[];
    active: boolean;
  }
): Promise<Result> {
  const s = await guard();
  if (!patch.name.trim()) return { error: "Ponle un nombre." };
  if (!patch.fields.some((f) => f.key === "name"))
    return { error: "El formulario necesita al menos el campo Nombre." };

  const { error } = await s.supabase
    .from("forms")
    .update({ ...patch, slug: slugify(patch.slug) })
    .eq("id", id);
  if (error)
    return {
      error: error.message.includes("duplicate")
        ? "Ya existe un formulario con esa dirección."
        : error.message,
    };
  revalidateAll();
  return {};
}

export async function deleteForm(id: string): Promise<Result> {
  const s = await guard();
  const { error } = await s.supabase.from("forms").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}
