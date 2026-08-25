"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  { name: "Elena Vidal", email: "elena@northbeam.io", company: "Northbeam", status: "customer", role: "VP Operations", phone: "+34 611 88 04 21", source: "LinkedIn orgánico" },
  { name: "Tomás Aguirre", email: "t.aguirre@lumendata.com", company: "Lumen Data", status: "prospect", role: "Head of Data", phone: "+34 622 10 55 09", source: "Referido" },
  { name: "Nadia Kirsch", email: "nadia@parallelhq.com", company: "Parallel HQ", status: "lead", role: "Founder", phone: "+34 633 71 22 88", source: "Landing agentes" },
  { name: "Bruno Sala", email: "bruno.sala@veridian.co", company: "Veridian", status: "customer", role: "CTO", phone: "+34 644 02 19 37", source: "Evento" },
  { name: "Irene Castells", email: "irene@quantalabs.ai", company: "Quanta Labs", status: "prospect", role: "Product Lead", phone: "+34 655 63 40 12", source: "Newsletter" },
  { name: "Marc Oliveras", email: "marc@hexafleet.com", company: "Hexafleet", status: "lead", role: "COO", phone: "+34 666 91 33 74", source: "Cold outbound" },
  { name: "Sofía Renard", email: "sofia@atlasgrid.eu", company: "Atlas Grid", status: "prospect", role: "Innovation Dir.", phone: "+34 677 45 80 61", source: "Webinar" },
  { name: "Iván Bosch", email: "ivan@cobaltworks.io", company: "Cobalt Works", status: "customer", role: "Head of CX", phone: "+34 688 27 16 50", source: "Referido" },
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { error: "El workspace ya tiene contactos." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const author = profile?.full_name || user.email!.split("@")[0];

  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .insert(COMPANIES.map((c) => ({ ...c, owner_id: user.id })))
    .select("id, name");
  if (cErr) return { error: cErr.message };
  const companyId = new Map(companies!.map((c) => [c.name, c.id]));

  const { data: contacts, error: ctErr } = await supabase
    .from("contacts")
    .insert(
      CONTACTS.map((c, i) => ({
        owner_id: user.id,
        company_id: companyId.get(c.company) ?? null,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
        status: c.status,
        source: c.source,
        timezone: "CET · Madrid",
        created_at: daysAgo(120 - i * 9),
      }))
    )
    .select("id, name");
  if (ctErr) return { error: ctErr.message };
  const contactId = new Map(contacts!.map((c) => [c.name, c.id]));

  const { data: deals, error: dErr } = await supabase
    .from("deals")
    .insert(
      DEALS.map((d, i) => ({
        owner_id: user.id,
        company_id: companyId.get(d.company) ?? null,
        contact_id: contactId.get(d.contact) ?? null,
        name: d.name,
        value: d.value,
        stage: d.stage,
        project_type: d.type,
        close_date: dateAhead(d.close),
        owner_initials: d.owner,
        notes: "",
        created_at: daysAgo(90 - i * 6),
        closed_at: d.stage === 5 ? daysAgo(3) : null,
      }))
    )
    .select("id, name, contact_id");
  if (dErr) return { error: dErr.message };
  const mainDeal = deals!.find((d) => d.name === "Agente de soporte RAG");

  const activities = [
    ...TIMELINE.map((t) => ({
      owner_id: user.id,
      contact_id: contactId.get("Elena Vidal") ?? null,
      deal_id: mainDeal?.id ?? null,
      kind: t.kind,
      title: t.title,
      body: t.body,
      author: t.author === "Marta Ruiz" ? author : t.author,
      occurred_at: daysAgo(t.days),
    })),
    ...UPCOMING.map((u) => ({
      owner_id: user.id,
      contact_id: contactId.get(u.contact) ?? null,
      deal_id: deals!.find((d) => d.contact_id === contactId.get(u.contact))?.id ?? null,
      kind: u.kind,
      title: u.title,
      body: u.body,
      author,
      occurred_at: daysAhead(u.inDays),
    })),
  ];

  const { error: aErr } = await supabase.from("activities").insert(activities);
  if (aErr) return { error: aErr.message };

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: author,
    email: user.email!,
    role: "Head of Growth",
  });

  revalidatePath("/", "layout");
  return {};
}
