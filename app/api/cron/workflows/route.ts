import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resumeDueRuns } from "@/lib/workflows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reanuda las automatizaciones que estaban esperando.
 * La llama pg_cron cada minuto; protegida por CRON_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  if (!secret || given !== secret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!service) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_KEY." }, { status: 500 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });

  const resumed = await resumeDueRuns(admin);
  return NextResponse.json({ ok: true, resumed });
}

export async function GET(request: Request) {
  return POST(request);
}
