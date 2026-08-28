import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Lo común a todas las funciones.
 *
 * Estas cuatro funciones son lo único del CRM que sigue atendiendo llamadas de
 * fuera: los formularios públicos, la captación de leads, la API que ejecutan
 * n8n y Make, y el cron que reanuda las esperas. Viven en Supabase, junto a los
 * datos, para que la aplicación instalada no dependa de ningún alojamiento web.
 */

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Api-Key, X-Cron-Secret, apikey",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

export const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" },
  });

/** Cliente con la clave de servicio: salta RLS, así que sólo aquí dentro. */
export function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Envuelve el manejador: responde al preflight y no deja escapar excepciones. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      return await handler(req);
    } catch (err) {
      console.error(err);
      return json({ error: err instanceof Error ? err.message : "Error inesperado." }, 500);
    }
  });
}

/**
 * Workspace dueño de una clave `aur_live_…`.
 * Devuelve null si la clave no vale, y quien llama decide el 401.
 */
export async function workspaceForKey(req: Request) {
  const key =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!key.startsWith("aur_live_")) return null;

  const { data } = await admin()
    .from("workspaces")
    .select("id, created_by")
    .eq("api_key", key)
    .maybeSingle();

  return (data as { id: string; created_by: string } | null) ?? null;
}
