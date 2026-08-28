import { admin, json, serve } from "../_shared/http.ts";
import { resumeDueRuns } from "../_shared/workflows.ts";

/**
 * Reanuda las automatizaciones que estaban esperando.
 *
 * La llama pg_cron cada minuto desde la propia base de datos. Va protegida por
 * CRON_SECRET porque, aunque la función viva en Supabase, su URL es pública.
 */
serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  const given =
    req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";

  if (!secret || given !== secret) return json({ error: "No autorizado." }, 401);

  const resumed = await resumeDueRuns(admin());
  return json({ ok: true, resumed });
});
