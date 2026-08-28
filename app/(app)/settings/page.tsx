"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData, useSession } from "@/components/SessionGate";
import ProfileForm from "@/components/ProfileForm";
import DataSettings from "@/components/DataSettings";
import InstallApp from "@/components/InstallApp";
import TeamSettings from "@/components/TeamSettings";
import { ApiSettings, FieldsSettings } from "@/components/ApiSettings";
import IntegrationsSettings, { type Integration } from "@/components/IntegrationsSettings";
import { GOLD, STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import { eur, relative } from "@/lib/format";
import type { AuditEntry, CustomField, Deal, Invitation } from "@/lib/types";

const TABS: [string, string][] = [
  ["profile", "Perfil"],
  ["team", "Equipo"],
  ["pipeline", "Pipeline"],
  ["fields", "Campos"],
  ["api", "API"],
  ["integrations", "Integraciones"],
  ["audit", "Historial"],
  ["data", "Datos"],
  ["app", "Aplicación"],
];

const ACTION_LABEL: Record<string, string> = {
  create: "creó",
  update: "editó",
  delete: "envió a la papelera",
  restore: "restauró",
  purge: "borró definitivamente",
};

const ENTITY_LABEL: Record<string, string> = {
  contacts: "el contacto",
  deals: "el deal",
  companies: "la empresa",
};

export default function SettingsPage() {
  return (
    <QueryBoundary>
      <Settings />
    </QueryBoundary>
  );
}

function Settings() {
  const tab = useQuery().get("tab") || "profile";
  const s = useSession();
  const { workspace, members, isAdmin } = s;

  // Cada pestaña pide sólo lo suyo: entrar en Ajustes no debe costar
  // siete consultas cuando se ven los datos de una.
  const { data: loaded } = useData(
    async ({ supabase }) => {
      const needsDeals = tab === "pipeline" || tab === "data";
      const needsCounts = tab === "data";

      const [dealsRes, invitationsRes, fieldsRes, integrationsRes, auditRes, countsRes] =
        await Promise.all([
          needsDeals
            ? supabase.from("deals").select("id, stage, value").is("deleted_at", null)
            : Promise.resolve({ data: [] }),
          tab === "team"
            ? supabase.from("invitations").select("*").order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          tab === "fields"
            ? supabase.from("custom_fields").select("*").order("created_at", { ascending: true })
            : Promise.resolve({ data: [] }),
          tab === "integrations"
            ? supabase.from("integrations").select("*")
            : Promise.resolve({ data: [] }),
          tab === "audit"
            ? supabase
                .from("audit_log")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(120)
            : Promise.resolve({ data: [] }),
          needsCounts
            ? Promise.all([
                supabase
                  .from("contacts")
                  .select("id", { count: "exact", head: true })
                  .is("deleted_at", null),
                supabase
                  .from("companies")
                  .select("id", { count: "exact", head: true })
                  .is("deleted_at", null),
                supabase
                  .from("activities")
                  .select("id", { count: "exact", head: true })
                  .is("deleted_at", null),
              ])
            : Promise.resolve(null),
        ]);

      const [contactCount, companyCount, activityCount] = countsRes ?? [
        { count: 0 },
        { count: 0 },
        { count: 0 },
      ];

      return {
        deals: (dealsRes.data ?? []) as Deal[],
        invitations: invitationsRes.data,
        fields: fieldsRes.data,
        entries: (auditRes.data ?? []) as AuditEntry[],
        integrations: (integrationsRes.data ?? []) as Integration[],
        counts: {
          Contactos: contactCount.count ?? 0,
          Empresas: companyCount.count ?? 0,
          Deals: (dealsRes.data ?? []).length,
          Actividades: activityCount.count ?? 0,
        },
      };
    },
    [tab]
  );

  if (!loaded) return <PageSkeleton />;
  const { deals, invitations, fields, entries, integrations } = loaded;

  return (
    <>
      <PageHeader crumb="Workspace" title="Ajustes" subtitle={workspace.name} />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="grid max-w-[1100px] grid-cols-1 items-start gap-6 lg:grid-cols-[180px_1fr] lg:gap-[26px]">
          <div className="flex flex-row flex-wrap gap-1 lg:sticky lg:top-0 lg:flex-col lg:gap-0.5">
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

          <div className="flex min-w-0 flex-col gap-4">
            {tab === "profile" && <ProfileForm profile={s.profile} email={s.email} />}

            {tab === "team" && (
              <TeamSettings
                workspace={workspace}
                members={members}
                invitations={(invitations ?? []) as Invitation[]}
                isAdmin={isAdmin}
                currentUserId={s.userId}
              />
            )}

            {tab === "pipeline" && (
              <div className="panel p-[26px]">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">
                  Etapas del pipeline
                </div>
                <div className="mt-1 text-[12.5px] text-ink-350">
                  Probabilidad por defecto usada para el forecast ponderado.
                </div>
                <div className="mt-3.5">
                  {STAGES.map((name, i) => {
                    const list = deals.filter((d) => d.stage === i);
                    const total = list.reduce((a, d) => a + Number(d.value), 0);
                    return (
                      <div key={name} className="hair-t flex flex-wrap items-center gap-3.5 py-3.5">
                        <span
                          className="h-[7px] w-[7px] rounded-full"
                          style={{ background: i === 6 ? "#7A3A3A" : i >= 4 ? GOLD : "#3A3A3A" }}
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

            {tab === "fields" && (
              <FieldsSettings fields={(fields ?? []) as CustomField[]} isAdmin={isAdmin} />
            )}

            {tab === "api" && (
              <ApiSettings workspace={workspace} isAdmin={isAdmin} />
            )}

            {tab === "integrations" && (
              <IntegrationsSettings
                n8n={integrations.find((i) => i.provider === "n8n") ?? null}
                make={integrations.find((i) => i.provider === "make") ?? null}
              />
            )}

            {tab === "audit" && (
              <div className="panel p-[26px]">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">
                  Historial de cambios
                </div>
                <div className="mt-1 text-[12.5px] text-ink-350">
                  Cada alta, edición y borrado queda registrado en la base de datos.
                </div>
                <div className="mt-3">
                  {entries.length === 0 && (
                    <div className="py-6 text-[12.5px] text-ink-400">
                      Todavía no hay movimientos registrados.
                    </div>
                  )}
                  {entries.map((e) => {
                    const who =
                      members.find((m) => m.user_id === e.user_id)?.profile?.full_name ??
                      "Alguien";
                    const changed = Object.keys(e.changes ?? {});
                    return (
                      <div key={e.id} className="hair-t py-3">
                        <div className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                          <span className="font-medium">{who}</span>
                          <span className="text-ink-350">
                            {ACTION_LABEL[e.action] ?? e.action}{" "}
                            {ENTITY_LABEL[e.entity] ?? e.entity}
                          </span>
                          <span className="font-medium">{e.label || "(sin nombre)"}</span>
                          <div className="flex-1" />
                          <span className="text-[11px] text-ink-450">
                            {relative(e.created_at)}
                          </span>
                        </div>
                        {changed.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {changed.slice(0, 6).map((k) => (
                              <span
                                key={k}
                                className="rounded border border-hair bg-ink-800 px-1.5 py-[2px] font-mono text-[10px] text-ink-400"
                              >
                                {k}
                              </span>
                            ))}
                            {changed.length > 6 && (
                              <span className="text-[10px] text-ink-500">
                                +{changed.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "app" && <InstallApp />}

            {tab === "data" && (
              <DataSettings
                counts={loaded.counts}
                isAdmin={isAdmin}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
