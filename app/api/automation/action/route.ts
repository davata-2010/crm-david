import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fillTemplate } from "@/lib/workflows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ok = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS });

/**
 * Acciones del CRM invocables desde fuera.
 *
 * Es lo que ejecutan los nodos del workflow generado en n8n o Make: el motor
 * externo orquesta y llama aquí para tocar los datos, así el CRM sigue siendo
 * el único sitio donde se escriben contactos, deals y actividades.
 *
 *   POST /api/automation/action
 *   X-Api-Key: aur_live_…
 *   { "action": "add_tag", "entity": "contacts", "id": "…", "value": "vip" }
 */
export async function POST(request: Request) {
  const key = request.headers.get("x-api-key") ?? "";
  if (!key.startsWith("aur_live_"))
    return ok({ error: "Falta la cabecera X-Api-Key." }, 401);

  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!service) return ok({ error: "Servidor sin configurar." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return ok({ error: "JSON no válido." }, 400);
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, created_by")
    .eq("api_key", key)
    .maybeSingle();
  if (!ws) return ok({ error: "Clave no válida." }, 401);

  const action = String(body.action ?? "");
  const entity = body.entity === "deals" ? "deals" : "contacts";
  const id = String(body.id ?? "");

  // Toda acción trabaja sobre un registro del workspace de la clave.
  if (!id && action !== "create_deal")
    return ok({ error: "Falta el id del registro." }, 400);

  const { data: record } = id
    ? await admin
        .from(entity)
        .select("*")
        .eq("id", id)
        .eq("workspace_id", ws.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  if (id && !record)
    return ok({ error: "El registro no existe en este workspace." }, 404);

  const rec = (record ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => fillTemplate(String(v ?? ""), rec);

  try {
    switch (action) {
      case "get_record":
        return ok({ ok: true, record: rec });

      case "add_tag":
      case "remove_tag": {
        const tag = text(body.value).trim();
        if (!tag) return ok({ error: "Falta la etiqueta." }, 400);
        const current = (rec.tags as string[]) ?? [];
        const tags =
          action === "add_tag"
            ? Array.from(new Set([...current, tag])).slice(0, 12)
            : current.filter((t) => t !== tag);
        await admin.from(entity).update({ tags }).eq("id", id);
        return ok({ ok: true, tags });
      }

      case "set_status": {
        const value = String(body.value ?? "");
        if (!["lead", "prospect", "customer"].includes(value))
          return ok({ error: "Estado no válido." }, 400);
        await admin.from("contacts").update({ status: value }).eq("id", id);
        return ok({ ok: true, status: value });
      }

      case "set_stage": {
        const stage = Number(body.value);
        if (!Number.isInteger(stage) || stage < 0 || stage > 6)
          return ok({ error: "Etapa no válida (0-6)." }, 400);
        await admin.from("deals").update({ stage }).eq("id", id);
        await admin.from("activities").insert({
          workspace_id: ws.id,
          owner_id: ws.created_by,
          deal_id: id,
          contact_id: (rec.contact_id as string) ?? null,
          kind: "Pipeline",
          title: "Etapa cambiada por automatización",
          body: `Nueva etapa: ${stage}.`,
          author: "Automatización",
          occurred_at: new Date().toISOString(),
          due_date: null,
          completed: false,
        });
        return ok({ ok: true, stage });
      }

      case "assign": {
        const userId = body.value ? String(body.value) : null;
        await admin.from(entity).update({ assigned_to: userId }).eq("id", id);
        return ok({ ok: true, assigned_to: userId });
      }

      case "create_task":
      case "add_note": {
        const isTask = action === "create_task";
        const due = isTask
          ? new Date(Date.now() + (Number(body.dueInDays) || 0) * 86_400_000).toISOString()
          : null;
        const { data: created, error } = await admin
          .from("activities")
          .insert({
            workspace_id: ws.id,
            owner_id: ws.created_by,
            contact_id: entity === "contacts" ? id : (rec.contact_id as string) ?? null,
            deal_id: entity === "deals" ? id : null,
            kind: String(body.kind ?? (isTask ? "Tarea" : "Nota")),
            title: text(body.title) || (isTask ? "Tarea" : "Nota"),
            body: text(body.body),
            author: "Automatización",
            occurred_at: new Date().toISOString(),
            due_date: due,
            completed: false,
          })
          .select("id")
          .single();
        if (error) return ok({ error: error.message }, 500);
        return ok({ ok: true, activity_id: created.id });
      }

      case "create_deal": {
        const { data: created, error } = await admin
          .from("deals")
          .insert({
            workspace_id: ws.id,
            owner_id: ws.created_by,
            assigned_to: (rec.assigned_to as string) ?? ws.created_by,
            contact_id: entity === "contacts" ? id || null : null,
            company_id: (rec.company_id as string) ?? null,
            name: text(body.name) || "Deal",
            value: Number(body.value) || 0,
            stage: Number(body.stage) || 0,
            project_type: String(body.project_type ?? "Agentes"),
          })
          .select("id")
          .single();
        if (error) return ok({ error: error.message }, 500);
        return ok({ ok: true, deal_id: created.id });
      }

      default:
        return ok({ error: `Acción "${action}" no soportada.` }, 400);
    }
  } catch (err) {
    return ok(
      { error: err instanceof Error ? err.message : "Error inesperado." },
      500
    );
  }
}
