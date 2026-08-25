import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import EmptyWorkspace from "@/components/EmptyWorkspace";
import { buildDashboard, needsAttention, splitTasks } from "@/lib/metrics";
import { eur, initials, monthLabel } from "@/lib/format";
import { GOLD, STAGES } from "@/lib/constants";
import type { Activity, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: dealsData }, { data: activitiesData }] = await Promise.all([
    supabase
      .from("deals")
      .select("*, company:companies(id,name), contact:contacts(id,name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*, contact:contacts(id,name), deal:deals(id,name)")
      .order("occurred_at", { ascending: false }),
  ]);

  const deals = (dealsData ?? []) as Deal[];
  const activities = (activitiesData ?? []) as Activity[];

  if (deals.length === 0 && activities.length === 0) {
    return (
      <>
        <PageHeader crumb="Panel" title="Resumen de agencia" />
        <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
          <EmptyWorkspace />
        </div>
      </>
    );
  }

  const { kpis, stageBars, pipelineTotal } = buildDashboard(deals, activities);
  const attention = needsAttention(deals, activities);
  const tasks = splitTasks(activities);
  const focus = [...tasks.overdue, ...tasks.today, ...tasks.week].slice(0, 6);

  const upcoming = activities
    .filter((a) => !a.due_date && new Date(a.occurred_at).getTime() >= Date.now() - 3_600_000)
    .sort((a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at))
    .slice(0, 4);

  return (
    <>
      <PageHeader
        crumb="Panel"
        title="Resumen de agencia"
        subtitle={`${tasks.pendingCount} tareas pendientes · ${attention.length} deals requieren atención`}
      />

      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Link
              key={k.label}
              href={k.href}
              className="panel px-5 pb-[18px] pt-5 text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.28)] hover:text-ink-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] uppercase tracking-[0.06em] text-ink-300">
                  {k.label}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: k.deltaColor }}>
                  {k.delta}
                </span>
              </div>
              <div className="tnum mt-3.5 text-[30px] font-semibold tracking-[-0.035em]">
                {k.value}
              </div>
              <div className="mt-1 text-[12px] text-ink-400">{k.sub}</div>
              <div className="mt-4 flex h-[30px] items-end gap-[3px]">
                {k.bars.map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[2px]"
                    style={{ height: b.h, background: b.color }}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.55fr_1fr] gap-4">
          <div className="panel px-6 pb-6 pt-[22px]">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.01em]">
                  Pipeline por etapa
                </div>
                <div className="mt-[3px] text-[12px] text-ink-400">
                  Valor por etapa, todos los deals
                </div>
              </div>
              <Link href="/pipeline" className="text-[12px] font-medium">
                {eur(pipelineTotal)} en juego
              </Link>
            </div>
            <div className="mt-6 flex flex-col gap-[15px]">
              {stageBars.map((s) => (
                <div key={s.name}>
                  <div className="mb-[7px] flex justify-between text-[12.5px]">
                    <span className="text-ink-150">{s.name}</span>
                    <span className="tnum text-ink-300">
                      {s.amount} · {s.count}
                    </span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-[4px] bg-ink-800">
                    <div
                      className="h-full rounded-[4px]"
                      style={{ width: s.w, background: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* foco del día: tareas */}
          <div className="panel px-6 pb-3 pt-[22px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-semibold tracking-[-0.01em]">Tu foco</div>
              <Link href="/tasks">Tareas</Link>
            </div>

            <div className="mt-[18px] flex flex-col">
              {focus.length === 0 && upcoming.length === 0 && (
                <div className="py-6 text-[12.5px] text-ink-400">
                  Nada pendiente.{" "}
                  <Link href="/tasks?new=1" className="text-gold">
                    Crear una tarea
                  </Link>
                </div>
              )}

              {focus.map((t) => {
                const d = new Date(t.due_date!);
                const overdue = d.getTime() < Date.now();
                return (
                  <Link
                    key={t.id}
                    href={t.contact_id ? `/contacts/${t.contact_id}` : "/tasks"}
                    className="hair-t flex gap-[13px] py-[11px] text-ink-50 hover:text-ink-50"
                  >
                    <div className="w-10 flex-[0_0_40px] text-center">
                      <div
                        className="text-[15px] font-semibold tracking-[-0.02em]"
                        style={{ color: overdue ? "#FF8F7A" : GOLD }}
                      >
                        {String(d.getDate()).padStart(2, "0")}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-400">
                        {monthLabel(d)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{t.title}</div>
                      <div className="mt-[3px] truncate text-[11.5px] text-ink-350">
                        {t.kind}
                        {t.contact ? ` · ${t.contact.name}` : ""}
                      </div>
                    </div>
                    <div
                      className="whitespace-nowrap text-[11px]"
                      style={{ color: overdue ? "#FF8F7A" : GOLD }}
                    >
                      {overdue
                        ? "vencida"
                        : d.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </div>
                  </Link>
                );
              })}

              {upcoming.map((a) => {
                const d = new Date(a.occurred_at);
                return (
                  <div key={a.id} className="hair-t flex gap-[13px] py-[11px]">
                    <div className="w-10 flex-[0_0_40px] text-center">
                      <div className="text-[15px] font-semibold tracking-[-0.02em] text-ink-50">
                        {String(d.getDate()).padStart(2, "0")}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-400">
                        {monthLabel(d)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{a.title}</div>
                      <div className="mt-[3px] truncate text-[11.5px] text-ink-350">
                        {a.kind} · {a.author || "—"}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-[11px] text-ink-400">
                      {d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {attention.length > 0 && (
          <div className="panel mt-4 px-6 pb-2 pt-[22px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-semibold tracking-[-0.01em]">
                Deals que necesitan atención
              </div>
              <Link href="/pipeline">Ver pipeline</Link>
            </div>
            <div className="mt-3.5">
              {attention.map(({ deal, reason }) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="hair-t flex items-center gap-4 px-1 py-3.5 text-ink-50 transition-colors hover:bg-ink-870 hover:text-ink-50"
                >
                  <div className="grid h-[30px] w-[30px] flex-[0_0_30px] place-items-center rounded-lg bg-ink-800 text-[11px] font-semibold text-gold">
                    {initials(deal.company?.name || deal.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{deal.name}</div>
                    <div className="mt-[2px] truncate text-[11.5px] text-ink-350">
                      {deal.company?.name || "Sin empresa"} · {STAGES[deal.stage]}
                    </div>
                  </div>
                  <div className="text-[12px] text-ink-300">{reason}</div>
                  <div className="tnum w-[92px] text-right text-[13.5px] font-semibold">
                    {eur(Number(deal.value))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
