import { admin, json, serve } from "../_shared/http.ts";
import { fireTrigger } from "../_shared/workflows.ts";

/**
 * Envío de un formulario público.
 *
 * No lleva clave: la protege el propio formulario, que sólo acepta envíos si
 * su slug existe y está activo. Crea o reutiliza el contacto —sin duplicar por
 * email— y dispara las automatizaciones de "se envía un formulario".
 */
serve(async (req) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON no válido." }, 400);
  }

  const slug = String(body.slug ?? "").trim();
  const values = (body.values ?? {}) as Record<string, string>;
  if (!slug) return json({ error: "Falta el formulario." }, 400);

  const db = admin();
  const { data: form } = await db
    .from("forms")
    .select("*")
    .ilike("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!form) return json({ error: "Formulario no disponible." }, 404);

  const name = String(values.name ?? "").trim();
  if (!name) return json({ error: "El nombre es obligatorio." }, 400);

  const email = String(values.email ?? "").trim();
  const ws = form.workspace_id as string;

  // Empresa por nombre, si el formulario la pide.
  let companyId: string | null = null;
  const companyName = String(values.company ?? "").trim();
  if (companyName) {
    const { data: existing } = await db
      .from("companies")
      .select("id")
      .eq("workspace_id", ws)
      .ilike("name", companyName)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) companyId = existing.id;
    else {
      const { data: created } = await db
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
    const { data: dup } = await db
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
    const { data: created, error } = await db
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
    if (error) return json({ error: error.message }, 500);
    contactId = created.id;
  }

  const message = String(values.message ?? "").trim();
  await db.from("activities").insert({
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

  await db.from("form_submissions").insert({
    workspace_id: ws,
    form_id: form.id,
    contact_id: contactId,
    data: values,
  });
  await db
    .from("forms")
    .update({ submissions: (form.submissions ?? 0) + 1 })
    .eq("id", form.id);

  const { data: record } = await db.from("contacts").select("*").eq("id", contactId).single();
  if (record) {
    await fireTrigger(
      { supabase: db, workspaceId: ws, actor: form.created_by },
      "form.submitted",
      { entity: "contacts", record, formId: form.id }
    );
  }

  return json({ ok: true, message: form.success_message, redirect: form.redirect_url || null }, 201);
});
