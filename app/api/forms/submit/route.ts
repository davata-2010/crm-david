import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fireTrigger } from "@/lib/workflows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Envío de un formulario público. Crea o reutiliza el contacto y dispara. */
export async function POST(request: Request) {
  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!service)
    return NextResponse.json({ error: "Servidor sin configurar." }, { status: 500, headers: CORS });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400, headers: CORS });
  }

  const slug = String(body.slug ?? "").trim();
  const values = (body.values ?? {}) as Record<string, string>;
  if (!slug) return NextResponse.json({ error: "Falta el formulario." }, { status: 400, headers: CORS });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });

  const { data: form } = await admin
    .from("forms")
    .select("*")
    .ilike("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!form)
    return NextResponse.json({ error: "Formulario no disponible." }, { status: 404, headers: CORS });

  const name = String(values.name ?? "").trim();
  if (!name)
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400, headers: CORS });

  const email = String(values.email ?? "").trim();
  const ws = form.workspace_id as string;

  // Empresa por nombre, si el formulario la pide.
  let companyId: string | null = null;
  const companyName = String(values.company ?? "").trim();
  if (companyName) {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", ws)
      .ilike("name", companyName)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) companyId = existing.id;
    else {
      const { data: created } = await admin
        .from("companies")
        .insert({ workspace_id: ws, owner_id: form.created_by, name: companyName })
        .select("id")
        .single();
      companyId = created?.id ?? null;
    }
  }

  // Si el email ya existe no se duplica: se registra otro envío.
  let contactId: string | null = null;
  if (email) {
    const { data: dup } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", ws)
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();
    contactId = dup?.id ?? null;
  }

  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!["name", "email", "phone", "company", "message"].includes(k)) custom[k] = v;
  }

  if (!contactId) {
    const { data: created, error } = await admin
      .from("contacts")
      .insert({
        workspace_id: ws,
        owner_id: form.created_by,
        assigned_to: form.created_by,
        company_id: companyId,
        name,
        email,
        phone: String(values.phone ?? "").trim(),
        status: "lead",
        source: `Formulario: ${form.name}`,
        tags: form.tags ?? [],
        custom,
      })
      .select("id")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
    contactId = created.id;
  }

  const message = String(values.message ?? "").trim();
  await admin.from("activities").insert({
    workspace_id: ws,
    owner_id: form.created_by,
    contact_id: contactId,
    kind: "Origen",
    title: `Envío del formulario "${form.name}"`,
    body:
      message ||
      Object.entries(values)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · "),
    author: "Formulario",
    occurred_at: new Date().toISOString(),
    due_date: null,
    completed: false,
  });

  await admin.from("form_submissions").insert({
    workspace_id: ws,
    form_id: form.id,
    contact_id: contactId,
    data: values,
  });
  await admin
    .from("forms")
    .update({ submissions: (form.submissions ?? 0) + 1 })
    .eq("id", form.id);

  const { data: record } = await admin.from("contacts").select("*").eq("id", contactId).single();
  if (record) {
    await fireTrigger(
      { supabase: admin, workspaceId: ws, actor: form.created_by },
      "form.submitted",
      { entity: "contacts", record, formId: form.id }
    );
  }

  return NextResponse.json(
    { ok: true, message: form.success_message, redirect: form.redirect_url || null },
    { status: 201, headers: CORS }
  );
}
