import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, memberName } from "@/lib/workspace";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/Timeline";
import AddActivity from "@/components/AddActivity";
import DealForm from "@/components/DealForm";
import EditToggle from "@/components/EditToggle";
import StageSwitcher from "@/components/StageSwitcher";
import DealActions from "@/components/DealActions";
import Tag from "@/components/Tag";
import AiPanel from "@/components/AiPanel";
import Attachments from "@/components/Attachments";
import { GOLD, STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import { eur, initials, shortDate, relative } from "@/lib/format";
import type { Activity, Attachment, CustomField, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string; task?: string };
}) {
  const session = await getSession();
  const { supabase, members, canWrite, workspace } = session;

  const [{ data: dealData }, { data: activitiesData }, { data: companies }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("deals")
        .select("*, company:companies(id,name), contact:contacts(id,name)")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("activities")
        .select("*")
        .eq("deal_id", params.id)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false }),
      supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("contacts").select("id, name, company_id").is("deleted_at", null).order("name"),
    ]);

  const [{ data: attachments }, { data: customFields }] = await Promise.all([
    supabase
      .from("attachments")
      .select("*")
      .eq("deal_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("custom_fields")
      .select("*")
      .eq("entity", "deals")
      .order("position", { ascending: true }),
  ]);

  const deal = dealData as Deal | null;
  if (!deal) notFound();

  const activities = (activitiesData ?? []) as Activity[];
  const editing = searchParams.edit === "1";
  const weighted = (Number(deal.value) * STAGE_PROBABILITY[deal.stage]) / 100;

  const stats = [
    { label: "Valor", value: eur(Number(deal.value)), color: GOLD },
    { label: "Ponderado", value: eur(weighted), color: "#F5F5F5" },
    { label: "Probabilidad", value: `${STAGE_PROBABILITY[deal.stage]}%`, color: "#F5F5F5" },
    { label: "Cierre", value: shortDate(deal.close_date), color: "#F5F5F5" },
  ];

  const fields = [
    { label: "Etapa", value: STAGES[deal.stage] },
    { label: "Empresa", value: deal.company?.name || "—" },
    { label: "Contacto", value: deal.contact?.name || "—" },
    { label: "Tipo", value: deal.project_type },
    ...(deal.stage === 6
      ? [{ label: "Motivo pérdida", value: deal.lost_reason || "Sin especificar" }]
      : []),
    { label: "Creado", value: relative(deal.created_at) },
    { label: "Actualizado", value: relative(deal.updated_at) },
    { label: "Responsable", value: memberName(members, deal.assigned_to) },
    ...((customFields ?? []) as CustomField[]).map((f) => ({
      label: f.label,
      value: String(deal.custom?.[f.key] ?? "—") || "—",
    })),
  ];

  return (
    <>
      <PageHeader crumb="Pipeline" title={deal.name} />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <Link
          href="/pipeline"
          className="mb-[18px] inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Volver al pipeline
        </Link>

        {editing ? (
          <DealForm
            companies={companies ?? []}
            contacts={contacts ?? []}
            deal={deal}
            members={members}
            fields={(customFields ?? []) as CustomField[]}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="panel px-[26px] pb-[22px] pt-[26px]">
                <div className="flex flex-wrap items-center gap-[18px]">
                  <div className="grid h-[58px] w-[58px] flex-[0_0_58px] place-items-center rounded-[14px] border border-[rgba(250,197,28,0.35)] bg-ink-800 text-[18px] font-semibold text-gold">
                    {initials(deal.company?.name || deal.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[11px]">
                      <h2 className="m-0 truncate text-[21px] font-semibold tracking-[-0.02em]">
                        {deal.name}
                      </h2>
                      <span
                        className="rounded-full px-[11px] py-1 text-[11px] font-semibold"
                        style={{
                          background:
                            deal.stage === 6
                              ? "rgba(255,143,122,0.12)"
                              : deal.stage === 5
                                ? GOLD
                                : "rgba(250,197,28,0.1)",
                          color:
                            deal.stage === 6 ? "#FF8F7A" : deal.stage === 5 ? "#080808" : GOLD,
                          border: `1px solid ${
                            deal.stage === 6
                              ? "rgba(255,143,122,0.4)"
                              : deal.stage === 5
                                ? GOLD
                                : "rgba(250,197,28,0.35)"
                          }`,
                        }}
                      >
                        {STAGES[deal.stage]}
                      </span>
                    </div>
                    {(deal.tags ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(deal.tags ?? []).map((t) => (
                          <Tag key={t} tag={t} />
                        ))}
                      </div>
                    )}
                    <div className="mt-[5px] text-[13px] text-ink-300">
                      {deal.company?.name || "Sin empresa"} ·{" "}
                      {deal.contact ? (
                        <Link href={`/contacts/${deal.contact.id}`}>{deal.contact.name}</Link>
                      ) : (
                        "Sin contacto"
                      )}
                    </div>
                  </div>
                  <EditToggle />
                  <DealActions deal={deal} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-px lg:grid-cols-4 overflow-hidden rounded-[11px] bg-hair">
                  {stats.map((s) => (
                    <div key={s.label} className="bg-ink-880 px-4 py-[15px]">
                      <div className="text-[10.5px] uppercase tracking-[0.09em] text-ink-350">
                        {s.label}
                      </div>
                      <div
                        className="tnum mt-1.5 text-[17px] font-semibold tracking-[-0.02em]"
                        style={{ color: s.color }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-[9px] text-[11px] uppercase tracking-[0.1em] text-ink-300">
                    Mover de etapa
                  </div>
                  <StageSwitcher dealId={deal.id} stage={deal.stage} />
                </div>

                {deal.notes && (
                  <div className="mt-6 rounded-[10px] border border-hair bg-ink-925 px-3.5 py-3 text-[12.5px] leading-[1.6] text-ink-250">
                    {deal.notes}
                  </div>
                )}
              </div>

              <Timeline activities={activities} />
            </div>

            <div className="flex flex-col gap-4">
              <div className="panel px-[22px] pb-2.5 pt-[22px]">
                <div className="text-[14px] font-semibold">Datos</div>
                <div className="mt-2">
                  {fields.map((f) => (
                    <div
                      key={f.label}
                      className="hair-t flex justify-between gap-3.5 py-[11px] text-[12.5px]"
                    >
                      <span className="text-ink-350">{f.label}</span>
                      <span className="text-right text-ink-100">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <AiPanel dealId={deal.id} />

              <Attachments
                items={(attachments ?? []) as Attachment[]}
                workspaceId={workspace.id}
                dealId={deal.id}
                canWrite={canWrite}
              />

              {canWrite && (
                <AddActivity
                  dealId={deal.id}
                  contactId={deal.contact_id ?? undefined}
                  startAsTask={searchParams.task === "1"}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
