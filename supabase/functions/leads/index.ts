import { admin, json, serve, workspaceForKey } from "../_shared/http.ts";

/**
 * Captación de leads desde fuera del CRM.
 *
 *   POST /functions/v1/leads
 *   X-Api-Key: aur_live_…
 *   { "name": "...", "email": "...", "company": "...", "message": "...", "tags": "a,b" }
 *
 * Crea el contacto (y la empresa si hace falta) en el workspace dueño de la
 * clave, y registra la primera actividad de origen.
 */
serve(async (req) => {
  const ws = await workspaceForKey(req);
  if (!ws) return json({ error: "Clave no válida o cabecera X-Api-Key ausente." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON no válido." }, 400);
  }

  const name = String(body.name ?? "").trim();
  if (!name) return json({ error: "El campo 'name' es obligatorio." }, 400);

  const db = admin();
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
    const { data: existing } = await db
      .from("contacts")
      .select("id")
      .eq("workspace_id", ws.id)
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      await db.from("activities").insert({
        workspace_id: ws.id,
        owner_id: ws.created_by,
        contact_id: existing.id,
        kind: "Origen",
        title: "Nuevo envío desde la API",
        body: message || `Reenvío del formulario (${source}).`,
        author: "API",
      });
      return json({ ok: true, contact_id: existing.id, duplicate: true });
    }
  }

  let companyId: string | null = null;
  if (companyName) {
    const { data: company } = await db
      .from("companies")
      .select("id")
      .eq("workspace_id", ws.id)
      .ilike("name", companyName)
      .is("deleted_at", null)
      .maybeSingle();
    if (company) companyId = company.id;
    else {
      const { data: created } = await db
        .from("companies")
        .insert({ workspace_id: ws.id, owner_id: ws.created_by, name: companyName })
        .select("id")
        .single();
      companyId = created?.id ?? null;
    }
  }

  const { data: contact, error } = await db
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

  if (error) return json({ error: error.message }, 500);

  await db.from("activities").insert({
    workspace_id: ws.id,
    owner_id: ws.created_by,
    contact_id: contact.id,
    kind: "Origen",
    title: "Lead entrante desde la API",
    body: message || `Origen: ${source}.`,
    author: "API",
  });

  return json({ ok: true, contact_id: contact.id }, 201);
});
