import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Captación de leads desde fuera del CRM.
 *
 *   POST /api/leads
 *   X-Api-Key: aur_live_…
 *   { "name": "...", "email": "...", "company": "...", "message": "...", "tags": "a,b" }
 *
 * Crea el contacto (y la empresa si hace falta) en el workspace dueño de la clave,
 * y registra la primera actividad de origen.
 */
export async function POST(request: Request) {
  const key =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!key.startsWith("aur_live_")) {
    return NextResponse.json(
      { error: "Falta la cabecera X-Api-Key." },
      { status: 401, headers: CORS }
    );
  }

  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!service) {
    return NextResponse.json(
      { error: "El servidor no tiene configurada SUPABASE_SERVICE_KEY." },
      { status: 500, headers: CORS }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400, headers: CORS });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "El campo 'name' es obligatorio." },
      { status: 400, headers: CORS }
    );
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, created_by")
    .eq("api_key", key)
    .maybeSingle();

  if (!ws) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 401, headers: CORS });
  }

  const email = String(body.email ?? "").trim();
  const companyName = String(body.company ?? "").trim();
  const message = String(body.message ?? "").trim();
  const source = String(body.source ?? "API").trim();
  const tags = String(body.tags ?? "")
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

  // Evita duplicados obvios por email dentro del mismo workspace.
  if (email) {
    const { data: existing } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", ws.id)
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      await admin.from("activities").insert({
        workspace_id: ws.id,
        owner_id: ws.created_by,
        contact_id: existing.id,
        kind: "Origen",
        title: "Nuevo envío desde la API",
        body: message || `Reenvío del formulario (${source}).`,
        author: "API",
      });
      return NextResponse.json(
        { ok: true, contact_id: existing.id, duplicate: true },
        { status: 200, headers: CORS }
      );
    }
  }

  let companyId: string | null = null;
  if (companyName) {
    const { data: company } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", ws.id)
      .ilike("name", companyName)
      .is("deleted_at", null)
      .maybeSingle();
    if (company) companyId = company.id;
    else {
      const { data: created } = await admin
        .from("companies")
        .insert({ workspace_id: ws.id, owner_id: ws.created_by, name: companyName })
        .select("id")
        .single();
      companyId = created?.id ?? null;
    }
  }

  const { data: contact, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: ws.id,
      owner_id: ws.created_by,
      assigned_to: ws.created_by,
      company_id: companyId,
      name,
      email,
      phone: String(body.phone ?? "").trim(),
      role: String(body.role ?? "").trim(),
      status: "lead",
      source,
      tags,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  }

  await admin.from("activities").insert({
    workspace_id: ws.id,
    owner_id: ws.created_by,
    contact_id: contact.id,
    kind: "Origen",
    title: "Lead entrante desde la API",
    body: message || `Origen: ${source}.`,
    author: "API",
  });

  return NextResponse.json(
    { ok: true, contact_id: contact.id },
    { status: 201, headers: CORS }
  );
}
