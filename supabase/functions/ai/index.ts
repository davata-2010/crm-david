import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.71.2?target=deno";
import { json, serve } from "../_shared/http.ts";
import { STAGES, STAGE_PROBABILITY } from "../_shared/constants.ts";
import { eur, relative } from "../_shared/format.ts";

/**
 * El asistente.
 *
 * Vive aquí y no en la aplicación por una razón concreta: la clave de
 * Anthropic no puede viajar dentro de un instalador ni de un APK, donde
 * cualquiera podría leerla. La petición llega firmada con el JWT del usuario,
 * así que las consultas se hacen con SU sesión y las RLS siguen aplicando: sólo
 * ve lo que vería en pantalla.
 */

const MODEL = "claude-opus-5";

type Action = "resumen" | "email" | "score";

const SYSTEM: Record<Action, string> = {
  resumen: `Eres el analista de un CRM de una agencia de IA. Recibes la ficha de un contacto con sus deals y su historial de actividades.

Escribe en español de España, en tono directo y profesional, sin florituras.
Estructura la respuesta exactamente así, sin encabezados de markdown:

Situación: dos o tres frases sobre dónde está la relación ahora mismo.
Señales: dos o tres viñetas con "- " sobre lo que llama la atención (silencios, urgencias, riesgos, oportunidades).
Siguiente paso: una sola acción concreta y accionable, con el porqué en media frase.

No inventes datos que no estén en la ficha. Si falta información relevante, dilo.`,

  email: `Eres un comercial senior de una agencia de IA. Redactas un email de seguimiento en español de España.

Devuelve exactamente este formato, sin markdown:

Asunto: <asunto de menos de 60 caracteres>

<cuerpo del email>

Reglas del cuerpo: máximo 120 palabras, tuteo, sin superlativos ni palabras vacías, una sola llamada a la acción clara al final. Apóyate en el historial real que te dan. No inventes cifras, fechas ni compromisos que no aparezcan.`,

  score: `Eres el motor de puntuación de leads de un CRM. Recibes la ficha de un contacto.

Devuelve exactamente este formato, sin markdown y sin nada más:

Puntuación: <número entero del 0 al 100>
Temperatura: <Frío|Templado|Caliente>
Motivos:
- <motivo 1>
- <motivo 2>
- <motivo 3>
Riesgo: <la principal razón por la que este deal se puede caer, en una frase>

Puntúa con lo que tengas: valor en pipeline, etapa, frecuencia y recencia de actividad, tareas vencidas y estado del contacto. Sé exigente: un contacto sin actividad reciente no pasa de 40.`,
};

const LABEL: Record<Action, string> = {
  resumen: "Resumen de la cuenta",
  email: "Borrador de seguimiento",
  score: "Puntuación del lead",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = ReturnType<typeof createClient>;

serve(async (req) => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey)
    return json(
      {
        error:
          "Falta ANTHROPIC_API_KEY. Añádela con: supabase secrets set ANTHROPIC_API_KEY=… y vuelve a desplegar la función.",
        needsKey: true,
      },
      501
    );

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Falta la sesión." }, 401);

  let payload: { action?: string; contactId?: string; dealId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON no válido." }, 400);
  }

  const action = payload.action as Action;
  if (!SYSTEM[action]) return json({ error: "Acción no soportada." }, 400);

  // Cliente con el JWT de quien llama: las RLS siguen mandando.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }
  );

  const context = await buildContext(supabase, payload.contactId, payload.dealId);
  if (!context) return json({ error: "No encuentro ese registro." }, 404);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM[action],
      output_config: { effort: "low" },
      messages: [{ role: "user", content: context }],
    } as any);

    if ((response as any).stop_reason === "refusal")
      return json({ error: "El modelo declinó responder a esta ficha." }, 422);

    const text = (response as any).content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return json({ text, label: LABEL[action] });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return json({ error: "La ANTHROPIC_API_KEY no es válida." }, 401);
    if (error instanceof Anthropic.RateLimitError)
      return json({ error: "Límite de peticiones alcanzado. Prueba en un minuto." }, 429);
    if (error instanceof Anthropic.APIError)
      return json({ error: error.message }, error.status ?? 500);
    return json({ error: "Error inesperado llamando al modelo." }, 500);
  }
});

/** Arma un briefing de texto plano con lo que hay en la base de datos. */
async function buildContext(supabase: Db, contactId?: string, dealId?: string) {
  if (dealId) {
    const [{ data: deal }, { data: acts }] = await Promise.all([
      supabase
        .from("deals")
        .select("*, company:companies(name), contact:contacts(id,name,email,status)")
        .eq("id", dealId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("activities")
        .select("*")
        .eq("deal_id", dealId)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(30),
    ]);
    if (!deal) return null;

    const company = deal.company as unknown as { name?: string } | null;
    const contact = deal.contact as unknown as { name?: string; email?: string } | null;

    return [
      `DEAL: ${deal.name}`,
      `Empresa: ${company?.name ?? "sin empresa"}`,
      `Contacto: ${contact?.name ?? "sin contacto"}${contact?.email ? ` <${contact.email}>` : ""}`,
      `Valor: ${eur(Number(deal.value))} · Etapa: ${STAGES[deal.stage]} (${
        STAGE_PROBABILITY[deal.stage]
      }%)`,
      `Cierre estimado: ${deal.close_date ?? "sin fecha"}`,
      `Tipo: ${deal.project_type}`,
      deal.lost_reason ? `Motivo de pérdida: ${deal.lost_reason}` : "",
      deal.notes ? `Notas: ${deal.notes}` : "",
      `Creado ${relative(deal.created_at)}, actualizado ${relative(deal.updated_at)}.`,
      "",
      "HISTORIAL (más reciente primero):",
      ...formatActivities(acts ?? []),
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (!contactId) return null;

  const [{ data: contact }, { data: deals }, { data: acts }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, company:companies(name,industry)")
      .eq("id", contactId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("deals")
      .select("name, value, stage, close_date, project_type, lost_reason")
      .eq("contact_id", contactId)
      .is("deleted_at", null),
    supabase
      .from("activities")
      .select("*")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(30),
  ]);
  if (!contact) return null;

  const company = contact.company as unknown as { name?: string; industry?: string } | null;

  return [
    `CONTACTO: ${contact.name}`,
    `Cargo: ${contact.role || "desconocido"} · Estado: ${contact.status}`,
    `Empresa: ${company?.name ?? "sin empresa"}${company?.industry ? ` (${company.industry})` : ""}`,
    `Email: ${contact.email || "sin email"} · Teléfono: ${contact.phone || "sin teléfono"}`,
    `Origen: ${contact.source || "desconocido"}`,
    (contact.tags ?? []).length ? `Etiquetas: ${(contact.tags as string[]).join(", ")}` : "",
    `Alta ${relative(contact.created_at)}.`,
    "",
    "DEALS:",
    ...((deals ?? []).length
      ? (deals ?? []).map(
          (d: any) =>
            `- ${d.name}: ${eur(Number(d.value))}, ${STAGES[d.stage]}, cierre ${
              d.close_date ?? "sin fecha"
            }, tipo ${d.project_type}${d.lost_reason ? `, perdido por ${d.lost_reason}` : ""}`
        )
      : ["- ninguno"]),
    "",
    "HISTORIAL (más reciente primero):",
    ...formatActivities(acts ?? []),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatActivities(acts: Record<string, unknown>[]) {
  if (!acts.length) return ["- sin actividad registrada"];
  return acts.map((a) => {
    const pending =
      a.due_date && !a.completed
        ? new Date(a.due_date as string).getTime() < Date.now()
          ? " [TAREA VENCIDA]"
          : " [tarea pendiente]"
        : "";
    return `- ${relative(a.occurred_at as string)} · ${a.kind} · ${a.title}${pending}${
      a.body ? `: ${String(a.body).slice(0, 240)}` : ""
    }`;
  });
}
