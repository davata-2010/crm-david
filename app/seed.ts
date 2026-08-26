"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/workspace";

const COMPANIES = [
  { name: "Northbeam", industry: "Logística", website: "northbeam.io" },
  { name: "Lumen Data", industry: "Data & Analytics", website: "lumendata.com" },
  { name: "Parallel HQ", industry: "SaaS", website: "parallelhq.com" },
  { name: "Veridian", industry: "Industria", website: "veridian.co" },
  { name: "Quanta Labs", industry: "Research", website: "quantalabs.ai" },
  { name: "Atlas Grid", industry: "Energía", website: "atlasgrid.eu" },
  { name: "Hexafleet", industry: "Movilidad", website: "hexafleet.com" },
  { name: "Cobalt Works", industry: "Customer Experience", website: "cobaltworks.io" },
];

const CONTACTS = [
  { name: "Elena Vidal", email: "elena@northbeam.io", company: "Northbeam", status: "customer", role: "VP Operations", phone: "+34 611 88 04 21", source: "LinkedIn orgánico", tags: "enterprise, referencia" },
  { name: "Tomás Aguirre", email: "t.aguirre@lumendata.com", company: "Lumen Data", status: "prospect", role: "Head of Data", phone: "+34 622 10 55 09", source: "Referido", tags: "inbound" },
  { name: "Nadia Kirsch", email: "nadia@parallelhq.com", company: "Parallel HQ", status: "lead", role: "Founder", phone: "+34 633 71 22 88", source: "Landing agentes", tags: "startup, inbound" },
  { name: "Bruno Sala", email: "bruno.sala@veridian.co", company: "Veridian", status: "customer", role: "CTO", phone: "+34 644 02 19 37", source: "Evento", tags: "enterprise, prioridad alta" },
  { name: "Irene Castells", email: "irene@quantalabs.ai", company: "Quanta Labs", status: "prospect", role: "Product Lead", phone: "+34 655 63 40 12", source: "Newsletter", tags: "research" },
  { name: "Marc Oliveras", email: "marc@hexafleet.com", company: "Hexafleet", status: "lead", role: "COO", phone: "+34 666 91 33 74", source: "Cold outbound", tags: "outbound" },
  { name: "Sofía Renard", email: "sofia@atlasgrid.eu", company: "Atlas Grid", status: "prospect", role: "Innovation Dir.", phone: "+34 677 45 80 61", source: "Webinar", tags: "energia" },
  { name: "Iván Bosch", email: "ivan@cobaltworks.io", company: "Cobalt Works", status: "customer", role: "Head of CX", phone: "+34 688 27 16 50", source: "Referido", tags: "enterprise" },
];

const DEALS = [
  { name: "Agente de soporte RAG", company: "Northbeam", contact: "Elena Vidal", value: 96000, stage: 0, type: "Agentes", close: 36, owner: "MR" },
  { name: "Copiloto interno de ventas", company: "Lumen Data", contact: "Tomás Aguirre", value: 48000, stage: 1, type: "Copilotos", close: 48, owner: "JP" },
  { name: "Clasificador de tickets", company: "Parallel HQ", contact: "Nadia Kirsch", value: 22000, stage: 1, type: "Evals", close: 41, owner: "MR" },
  { name: "Búsqueda semántica en docs", company: "Veridian", contact: "Bruno Sala", value: 134000, stage: 2, type: "RAG", close: 85, owner: "AL" },
  { name: "Automatización de onboarding", company: "Quanta Labs", contact: "Irene Castells", value: 61500, stage: 2, type: "Automatización", close: 69, owner: "JP" },
  { name: "Voice agent para reservas", company: "Hexafleet", contact: "Marc Oliveras", value: 15000, stage: 3, type: "Agentes", close: 30, owner: "MR" },
  { name: "Forecast de demanda", company: "Atlas Grid", contact: "Sofía Renard", value: 78000, stage: 3, type: "Automatización", close: 45, owner: "AL" },
  { name: "Evaluación de modelos", company: "Cobalt Works", contact: "Iván Bosch", value: 52000, stage: 4, type: "Evals", close: 33, owner: "MR" },
  { name: "Retainer de datos", company: "Northbeam", contact: "Elena Vidal", value: 36000, stage: 4, type: "RAG", close: 51, owner: "JP" },
  { name: "Piloto de agentes multi-tool", company: "Veridian", contact: "Bruno Sala", value: 44000, stage: 5, type: "Agentes", close: 7, owner: "AL" },
  { name: "Chatbot de captación", company: "Parallel HQ", contact: "Nadia Kirsch", value: 18000, stage: 6, type: "Copilotos", close: -12, owner: "MR" },
];

const TIMELINE = [
  { title: "Llamada de discovery", kind: "Llamada", author: "Marta Ruiz", days: 0, body: "Repasamos el volumen de tickets (18k/mes) y los tres flujos que quieren automatizar primero. Falta confirmar quién firma el acceso a datos." },
  { title: "Propuesta enviada", kind: "Documento", author: "Marta Ruiz", days: 1, body: "Propuesta v2 con dos fases: piloto de 6 semanas y despliegue. Presupuesto €96.000." },
  { title: "Email respondido", kind: "Email", author: "Elena Vidal", days: 4, body: "Pide referencias de proyectos similares en logística y detalle del SLA de latencia." },
  { title: "Demo técnica", kind: "Reunión", author: "Alex Lorca", days: 11, body: "Demo del pipeline RAG con sus propios documentos. Buen feedback sobre citación de fuentes." },
  { title: "Lead creado", kind: "Origen", author: "Formulario web", days: 23, body: "Entró por la landing de agentes de soporte. Fuente: LinkedIn orgánico." },
];

const UPCOMING = [
  { title: "Discovery con Lumen Data", kind: "Reunión", contact: "Tomás Aguirre", inDays: 1, body: "Videollamada · repaso de fuentes de datos." },
  { title: "Enviar propuesta a Atlas Grid", kind: "Nota", contact: "Sofía Renard", inDays: 2, body: "Tarea · preparar alcance de forecast." },
  { title: "Revisión de evals con Cobalt", kind: "Reunión", contact: "Iván Bosch", inDays: 3, body: "Reunión técnica · métricas de calidad." },
  { title: "Seguimiento Parallel HQ", kind: "Llamada", contact: "Nadia Kirsch", inDays: 5, body: "Llamada de seguimiento tras la demo." },
  { title: "Kickoff Veridian", kind: "Reunión", contact: "Bruno Sala", inDays: 8, body: "Onsite · Barcelona." },
];

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const dateAhead = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

/** Rellena el workspace con el set de datos del handoff. Todo va a Supabase. */
export async function seedDemoData() {
  const s = await getSession();
  const supabase = s.supabase;
  const user = { id: s.userId, email: s.email };
  const ws = s.workspace.id;

  const author = s.profile?.full_name || s.email.split("@")[0];

  // El seed es reanudable: si una tanda falló a medias (o si se añaden filas
  // nuevas al set), crea sólo lo que falte en vez de negarse a hacer nada.
  const [existingCompanies, existingContacts, existingDeals, activityCount] =
    await Promise.all([
      supabase.from("companies").select("id, name").is("deleted_at", null),
      supabase.from("contacts").select("id, name").is("deleted_at", null),
      supabase.from("deals").select("id, name, contact_id").is("deleted_at", null),
      supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ]);

  const companyId = new Map((existingCompanies.data ?? []).map((c) => [c.name, c.id]));
  const contactId = new Map((existingContacts.data ?? []).map((c) => [c.name, c.id]));
  let deals = existingDeals.data ?? [];

  const nothingMissing =
    COMPANIES.every((c) => companyId.has(c.name)) &&
    CONTACTS.every((c) => contactId.has(c.name)) &&
    DEALS.every((d) => deals.some((x) => x.name === d.name)) &&
    (activityCount.count ?? 0) > 0;

  if (nothingMissing) return { error: "El workspace ya tiene los datos de ejemplo." };

  /* ---------------------------------------------------------- empresas --- */
  const missingCompanies = COMPANIES.filter((c) => !companyId.has(c.name));
  if (missingCompanies.length) {
    const { data, error } = await supabase
      .from("companies")
      .insert(missingCompanies.map((c) => ({ ...c, owner_id: user.id, workspace_id: ws })))
      .select("id, name");
    if (error) return { error: error.message };
    (data ?? []).forEach((c) => companyId.set(c.name, c.id));
  }

  /* --------------------------------------------------------- contactos --- */
  const missingContacts = CONTACTS.map((c, i) => ({ c, i })).filter(
    ({ c }) => !contactId.has(c.name)
  );
  if (missingContacts.length) {
    const { data, error } = await supabase
      .from("contacts")
      .insert(
        missingContacts.map(({ c, i }) => ({
          owner_id: user.id,
          workspace_id: ws,
          assigned_to: user.id,
          company_id: companyId.get(c.company) ?? null,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          status: c.status,
          source: c.source,
          timezone: "CET · Madrid",
          tags: (c as { tags?: string }).tags?.split(", ") ?? [],
          created_at: daysAgo(120 - i * 9),
        }))
      )
      .select("id, name");
    if (error) return { error: error.message };
    (data ?? []).forEach((c) => contactId.set(c.name, c.id));
  }

  /* ------------------------------------------------------------- deals --- */
  const missingDeals = DEALS.map((d, i) => ({ d, i })).filter(
    ({ d }) => !deals.some((x) => x.name === d.name)
  );
  if (missingDeals.length) {
    const { data, error } = await supabase
      .from("deals")
      .insert(
        missingDeals.map(({ d, i }) => ({
          owner_id: user.id,
          workspace_id: ws,
          assigned_to: user.id,
          company_id: companyId.get(d.company) ?? null,
          contact_id: contactId.get(d.contact) ?? null,
          name: d.name,
          value: d.value,
          stage: d.stage,
          project_type: d.type,
          close_date: dateAhead(d.close),
          owner_initials: d.owner,
          tags: d.stage === 6 ? [] : d.value >= 60000 ? ["enterprise"] : ["pyme"],
          lost_reason: d.stage === 6 ? "Eligió a un competidor" : "",
          notes: "",
          created_at: daysAgo(90 - i * 6),
          closed_at: d.stage >= 5 ? daysAgo(3) : null,
        }))
      )
      .select("id, name, contact_id");
    if (error) return { error: error.message };
    deals = [...deals, ...(data ?? [])];
  }

  // Si ya había actividades, no se duplican: el resto del set ya está puesto.
  if ((activityCount.count ?? 0) > 0) {
    revalidatePath("/", "layout");
    return {};
  }

  const mainDeal = deals.find((d) => d.name === "Agente de soporte RAG");

  /**
   * Todas las actividades pasan por aquí para que salgan con la MISMA forma.
   * supabase-js iguala las claves de un insert por lotes rellenando con null
   * las que falten en algún objeto, así que un array heterogéneo mandaría
   * completed: null y rompería el NOT NULL de la columna.
   */
  const activity = (a: {
    contactName?: string;
    dealId?: string | null;
    kind: string;
    title: string;
    body: string;
    author?: string;
    occurredAt: string;
    dueDate?: string | null;
  }) => ({
    owner_id: user.id,
    workspace_id: ws,
    contact_id: a.contactName ? contactId.get(a.contactName) ?? null : null,
    deal_id: a.dealId ?? null,
    kind: a.kind,
    title: a.title,
    body: a.body,
    author: a.author ?? author,
    occurred_at: a.occurredAt,
    due_date: a.dueDate ?? null,
    completed: false,
  });

  const dealByContact = (name: string) =>
    deals.find((d) => d.contact_id === contactId.get(name))?.id ?? null;
  const dealByName = (name: string) => deals.find((d) => d.name === name)?.id ?? null;

  const activities = [
    ...TIMELINE.map((t) =>
      activity({
        contactName: "Elena Vidal",
        dealId: mainDeal?.id ?? null,
        kind: t.kind,
        title: t.title,
        body: t.body,
        author: t.author === "Marta Ruiz" ? author : t.author,
        occurredAt: daysAgo(t.days),
      })
    ),
    ...UPCOMING.map((u) =>
      activity({
        contactName: u.contact,
        dealId: dealByContact(u.contact),
        kind: u.kind,
        title: u.title,
        body: u.body,
        occurredAt: daysAhead(u.inDays),
        dueDate: daysAhead(u.inDays),
      })
    ),
    // Dos tareas ya vencidas, para que se vea el aviso rojo del dashboard.
    activity({
      contactName: "Marc Oliveras",
      dealId: dealByName("Voice agent para reservas"),
      kind: "Llamada",
      title: "Llamar a Marc: sigue sin responder",
      body: "Tercer intento. Si no contesta, mover a nurturing.",
      occurredAt: daysAgo(2),
      dueDate: daysAgo(2),
    }),
    activity({
      contactName: "Irene Castells",
      dealId: dealByName("Automatización de onboarding"),
      kind: "Tarea",
      title: "Enviar estimación de esfuerzo a Quanta Labs",
      body: "Pidieron desglose por fases antes del comité.",
      occurredAt: daysAgo(5),
      dueDate: daysAgo(5),
    }),
  ];

  const { error: aErr } = await supabase.from("activities").insert(activities);
  if (aErr) return { error: aErr.message };

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: author,
    email: s.email,
    role: "Head of Growth",
  });

  revalidatePath("/", "layout");
  return {};
}
