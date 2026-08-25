import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/ProfileForm";
import DataSettings from "@/components/DataSettings";
import { GOLD, STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import { eur, initials, relative } from "@/lib/format";
import type { Deal, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["profile", "Perfil"],
  ["pipeline", "Pipeline"],
  ["team", "Equipo"],
  ["integrations", "Integraciones"],
  ["data", "Datos"],
];

const INTEGRATIONS = [
  { mark: "GC", name: "Google Calendar", desc: "Sincroniza reuniones y crea actividades automáticamente." },
  { mark: "GM", name: "Gmail", desc: "Registra hilos de email en el contacto correspondiente." },
  { mark: "SL", name: "Slack", desc: "Avisos de deals ganados en #revenue." },
  { mark: "ST", name: "Stripe", desc: "Importa facturación y retainers activos." },
  { mark: "LN", name: "LinkedIn", desc: "Enriquecimiento de leads entrantes." },
  { mark: "NT", name: "Notion", desc: "Vincula propuestas y documentos de delivery." },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const tab = searchParams.tab || "profile";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profileData },
    { data: dealsData },
    contactCount,
    companyCount,
    activityCount,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("deals").select("id, stage, value"),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("activities").select("id", { count: "exact", head: true }),
  ]);

  const profile = profileData as Profile | null;
  const deals = (dealsData ?? []) as Deal[];

  return (
    <>
      <PageHeader crumb="Workspace" title="Ajustes" />

      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <div className="grid max-w-[1060px] grid-cols-[190px_1fr] items-start gap-[26px]">
          <div className="sticky top-0 flex flex-col gap-0.5">
            {TABS.map(([key, label]) => {
              const active = tab === key;
              return (
                <Link
                  key={key}
                  href={`/settings?tab=${key}`}
                  className="rounded-[9px] px-[13px] py-2.5 text-left text-[13px] font-medium transition-colors"
                  style={{
                    background: active ? "rgba(250,197,28,0.1)" : "transparent",
                    color: active ? GOLD : "#8A8A8A",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {tab === "profile" && (
              <ProfileForm profile={profile} email={user!.email!} />
            )}

            {tab === "pipeline" && (
              <div className="panel p-[26px]">
                <div className="flex items-baseline gap-3">
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold tracking-[-0.01em]">
                      Etapas del pipeline
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-350">
                      Probabilidad por defecto usada para el forecast ponderado.
                    </div>
                  </div>
                </div>
                <div className="mt-3.5">
                  {STAGES.map((name, i) => {
                    const list = deals.filter((d) => d.stage === i);
                    const total = list.reduce((a, d) => a + Number(d.value), 0);
                    return (
                      <div key={name} className="hair-t flex items-center gap-3.5 py-3.5">
                        <span
                          className="h-[7px] w-[7px] rounded-full"
                          style={{ background: i >= 4 ? GOLD : "#3A3A3A" }}
                        />
                        <span className="flex-1 text-[13.5px] font-medium">{name}</span>
                        <span className="w-[130px] text-[12px] text-ink-350">
                          {list.length} deals · {eur(total)}
                        </span>
                        <div className="flex w-[190px] items-center gap-2.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-ink-800">
                            <div
                              className="h-full bg-gold"
                              style={{ width: `${STAGE_PROBABILITY[i]}%` }}
                            />
                          </div>
                          <span className="tnum w-[38px] text-right text-[12px] text-ink-100">
                            {STAGE_PROBABILITY[i]}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "team" && (
              <div className="panel p-[26px]">
                <div className="flex items-baseline gap-3">
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold tracking-[-0.01em]">Equipo</div>
                    <div className="mt-1 text-[12.5px] text-ink-350">
                      Este workspace es individual: cada cuenta ve sólo sus propios datos.
                    </div>
                  </div>
                </div>
                <div className="mt-3.5">
                  <div className="hair-t flex items-center gap-3.5 py-3.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(245,245,245,0.08)] bg-ink-800 text-[11.5px] font-semibold text-ink-150">
                      {initials(profile?.full_name || user!.email!)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">
                        {profile?.full_name || user!.email!.split("@")[0]}
                      </div>
                      <div className="text-[11.5px] text-ink-400">{user!.email}</div>
                    </div>
                    <span
                      className="rounded-full px-[11px] py-1 text-[11px] font-semibold"
                      style={{ background: GOLD, color: "#080808", border: `1px solid ${GOLD}` }}
                    >
                      Owner
                    </span>
                    <span className="w-[110px] text-right text-[12px] text-ink-350">
                      {relative(profile?.created_at ?? null)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === "data" && (
              <DataSettings
                counts={{
                  Contactos: contactCount.count ?? 0,
                  Empresas: companyCount.count ?? 0,
                  Deals: deals.length,
                  Actividades: activityCount.count ?? 0,
                }}
              />
            )}

            {tab === "integrations" && (
              <div className="flex flex-col gap-4">
                <div className="panel p-[26px]">
                  <div className="text-[15px] font-semibold tracking-[-0.01em]">
                    Integraciones
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-350">
                    Ninguna está conectada todavía en este workspace.
                  </div>
                  <div className="mt-[18px] grid grid-cols-2 gap-3">
                    {INTEGRATIONS.map((i) => (
                      <div
                        key={i.name}
                        className="rounded-[11px] border border-hair bg-ink-800 px-[17px] py-4"
                      >
                        <div className="flex items-center gap-[11px]">
                          <div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-ink-700 text-[12px] font-semibold text-ink-50">
                            {i.mark}
                          </div>
                          <div className="flex-1 text-[13.5px] font-medium">{i.name}</div>
                          <span className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-400">
                            SIN CONECTAR
                          </span>
                        </div>
                        <div className="mt-2.5 text-[11.5px] leading-[1.5] text-ink-350">
                          {i.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel p-[26px]">
                  <div className="text-[15px] font-semibold tracking-[-0.01em]">
                    Proyecto Supabase
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-350">
                    Tus datos viven aquí. La clave anónima es pública por diseño; el acceso lo
                    controla RLS.
                  </div>
                  <div className="mt-4 flex items-center gap-2.5">
                    <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] py-3 font-mono text-[12.5px] text-ink-150">
                      {process.env.NEXT_PUBLIC_SUPABASE_URL}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
