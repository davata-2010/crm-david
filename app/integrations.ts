"use client";

import { notifyChanged, requireSession } from "@/lib/session-client";
import {
  buildN8nExportFile,
  buildN8nWorkflow,
  n8nActivate,
  n8nPing,
  n8nSync,
  n8nWebhookUrl,
} from "@/lib/n8n";
import { buildMakeBlueprint } from "@/lib/make";
import { ACTION_URL } from "@/lib/config";
import type { WorkflowRow } from "@/lib/workflows";

type Result = { error?: string; ok?: boolean; info?: string };

async function admin() {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error("Sólo un administrador puede tocar las integraciones.");
  return s;
}

const revalidateAll = () => notifyChanged(true);

/* ========================================================= integraciones == */

export async function saveIntegration(
  provider: "n8n" | "make",
  patch: { base_url: string; api_key: string; team_id: string; active: boolean }
): Promise<Result> {
  const s = await admin();
  const base_url = patch.base_url.trim().replace(/\/+$/, "");

  if (patch.active && provider === "n8n") {
    if (!/^https?:\/\/.+/.test(base_url))
      return { error: "La URL de n8n debe empezar por http:// o https://" };
    if (!patch.api_key.trim()) return { error: "Falta la clave de API de n8n." };
  }

  const { error } = await s.supabase.from("integrations").upsert(
    {
      workspace_id: s.workspace.id,
      provider,
      base_url,
      api_key: patch.api_key.trim(),
      team_id: patch.team_id.trim(),
      active: patch.active,
    },
    { onConflict: "workspace_id,provider" }
  );
  if (error) return { error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Comprueba de verdad que las credenciales funcionan. */
export async function testIntegration(provider: "n8n" | "make"): Promise<Result> {
  const s = await admin();
  const { data: cfg } = await s.supabase
    .from("integrations")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (!cfg?.base_url || !cfg?.api_key)
    return { error: "Guarda primero la URL y la clave." };

  if (provider === "make")
    return {
      error:
        "Make no permite crear escenarios por API sin plan de equipo. Usa «Descargar blueprint» e impórtalo en Make.",
    };

  const res = await n8nPing(cfg.base_url, cfg.api_key);
  const stamp = new Date().toISOString();

  await s.supabase
    .from("integrations")
    .update({
      last_check: stamp,
      last_error: res.ok ? null : res.error,
    })
    .eq("id", cfg.id);

  revalidateAll();
  return res.ok
    ? { ok: true, info: "Conexión correcta con n8n." }
    : { error: res.error };
}

/* ============================================================ sincronizar == */

/** Crea o actualiza el workflow en n8n y guarda el enlace en Aurum. */
export async function syncWorkflowToN8n(workflowId: string): Promise<Result> {
  const s = await requireSession();
  if (!s.canWrite) return { error: "Tu rol es de sólo lectura." };

  const [{ data: flow }, { data: cfg }] = await Promise.all([
    s.supabase.from("workflows").select("*").eq("id", workflowId).maybeSingle(),
    s.supabase.from("integrations").select("*").eq("provider", "n8n").maybeSingle(),
  ]);

  if (!flow) return { error: "La automatización no existe." };
  if (!cfg?.active || !cfg.base_url || !cfg.api_key)
    return { error: "Conecta n8n primero en Ajustes → Integraciones." };
  if (!flow.steps?.length)
    return { error: "La automatización no tiene pasos que reflejar." };

  const workflow = flow as WorkflowRow;
  const path = `aurum-${workflow.id}`;
  const body = buildN8nWorkflow(workflow, {
    actionUrl: ACTION_URL,
    apiKey: s.workspace.api_key,
    webhookPath: path,
  });

  const res = await n8nSync(cfg.base_url, cfg.api_key, body, flow.external_id ?? null);

  if (!res.ok) {
    await s.supabase
      .from("workflows")
      .update({ external_error: res.error })
      .eq("id", workflowId);
    revalidateAll();
    return { error: res.error };
  }

  // Un workflow inactivo en n8n no atiende su webhook.
  const activation = await n8nActivate(cfg.base_url, cfg.api_key, res.data.id, true);

  await s.supabase
    .from("workflows")
    .update({
      engine: "n8n",
      external_id: res.data.id,
      external_name: res.data.name,
      external_url: n8nWebhookUrl(cfg.base_url, path),
      external_synced_at: new Date().toISOString(),
      external_error: activation.ok ? null : `Creado, pero no se pudo activar: ${activation.error}`,
    })
    .eq("id", workflowId);

  revalidateAll();
  return {
    ok: true,
    info: activation.ok
      ? "Reflejado y activado en n8n."
      : "Reflejado en n8n, pero actívalo a mano desde su interfaz.",
  };
}

/** Vuelve a ejecutar los pasos dentro de Aurum. */
export async function useAurumEngine(workflowId: string): Promise<Result> {
  const s = await requireSession();
  if (!s.canWrite) return { error: "Tu rol es de sólo lectura." };
  const { error } = await s.supabase
    .from("workflows")
    .update({ engine: "aurum" })
    .eq("id", workflowId);
  if (error) return { error: error.message };
  revalidateAll();
  return { ok: true, info: "Vuelve a ejecutarse dentro de Aurum." };
}

/* ================================================================ export == */

/** Devuelve el JSON listo para importar en n8n o en Make. */
export async function exportWorkflow(
  workflowId: string,
  target: "n8n" | "make"
): Promise<{ error?: string; filename?: string; json?: string }> {
  const s = await requireSession();
  const { data: flow } = await s.supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .maybeSingle();
  if (!flow) return { error: "La automatización no existe." };

  const workflow = flow as WorkflowRow;
  const slug =
    workflow.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "automatizacion";

  const body =
    target === "n8n"
      ? buildN8nExportFile(workflow, {
          actionUrl: ACTION_URL,
          apiKey: s.workspace.api_key,
          webhookPath: `aurum-${workflow.id}`,
        })
      : buildMakeBlueprint(workflow, { actionUrl: ACTION_URL, apiKey: s.workspace.api_key });

  return {
    filename: `${slug}-${target}.json`,
    json: JSON.stringify(body, null, 2),
  };
}
