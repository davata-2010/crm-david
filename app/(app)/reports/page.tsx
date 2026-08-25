import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import { buildReports } from "@/lib/metrics";
import { eur, eurCompact } from "@/lib/format";
import { GOLD } from "@/lib/constants";
import type { Activity, Company, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();

  const [{ data: deals }, { data: activities }, { data: companies }] = await Promise.all([
    supabase.from("deals").select("*, company:companies(id,name)").is("deleted_at", null),
    supabase.from("activities").select("*").is("deleted_at", null),
    supabase.from("companies").select("*").is("deleted_at", null),
  ]);

  const r = buildReports(
    (deals ?? []) as Deal[],
    (activities ?? []) as Activity[],
    (companies ?? []) as Company[]
  );
  const t = r.totals;

  const cards = [
    { label: "Ganado", value: eurCompact(t.won), sub: `${t.wonCount} deals`, color: GOLD },
    { label: "En pipeline", value: eurCompact(t.openValue), sub: `${t.openCount} abiertos`, color: "#F5F5F5" },
    { label: "Forecast ponderado", value: eurCompact(t.weighted), sub: "Por probabilidad de etapa", color: "#F5F5F5" },
    {
      label: "Tasa de victoria",
      value: t.winRate.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "%",
      sub: `${t.wonCount} ganados · ${t.lostCount} perdidos`,
      color: t.winRate >= 40 ? GOLD : "#F5F5F5",
    },
    { label: "Ticket medio", value: eurCompact(t.avgDeal), sub: "De los deals ganados", color: "#F5F5F5" },
    { label: "Perdido", value: eurCompact(t.lostValue), sub: `${t.lostCount} deals`, color: "#FF8F7A" },
  ];

  return (
    <>
      <PageHeader crumb="Analítica" title="Informes" subtitle="Todo calculado sobre tus datos reales" />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        {/* tarjetas resumen */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="panel px-4 pb-4 pt-[18px]">
              <div className="text-[10.5px] uppercase tracking-[0.09em] text-ink-350">
                {c.label}
              </div>
              <div
                className="tnum mt-2.5 text-[22px] font-semibold tracking-[-0.03em]"
                style={{ color: c.color }}
              >
                {c.value}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          {/* ingresos por mes */}
          <div className="panel px-6 pb-6 pt-[22px]">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              Ingresos por mes
            </div>
            <div className="mt-1 text-[12px] text-ink-400">
              Deals ganados en los últimos 12 meses
            </div>
            <div className="mt-6 flex h-[180px] items-end gap-2">
              {r.revenueRows.map((b, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      title={`${eur(b.value)} · ${b.count} deals`}
                      className="w-full rounded-t-[3px] transition-colors"
                      style={{
                        height: b.h,
                        background: i === r.revenueRows.length - 1 ? GOLD : "#2E2E2E",
                      }}
                    />
                  </div>
                  <span className="text-[10px] capitalize text-ink-450">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-hair pt-3 text-[11.5px] text-ink-400">
              <span>Máximo mensual: {eur(Math.max(...r.revenueRows.map((b) => b.value), 0))}</span>
              <span className="tnum">
                Total 12 meses: {eur(r.revenueRows.reduce((a, b) => a + b.value, 0))}
              </span>
            </div>
          </div>

          {/* embudo */}
          <div className="panel px-6 pb-6 pt-[22px]">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              Embudo de conversión
            </div>
            <div className="mt-1 text-[12px] text-ink-400">
              Deals que alcanzaron cada etapa
            </div>
            <div className="mt-5 flex flex-col gap-3.5">
              {r.funnelRows.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span className="text-ink-150">{f.name}</span>
                    <span className="tnum text-ink-350">
                      {f.count} · {f.conversion}
                    </span>
                  </div>
                  <div className="h-[9px] overflow-hidden rounded-[5px] bg-ink-800">
                    <div
                      className="h-full rounded-[5px]"
                      style={{
                        width: f.w,
                        background: f.stage >= 4 ? GOLD : "#3A3A3A",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* top empresas */}
          <div className="panel px-5 pb-3 pt-[20px]">
            <div className="text-[14px] font-semibold tracking-[-0.01em]">
              Empresas por valor
            </div>
            <div className="mt-3">
              {r.topCompanies.length === 0 && (
                <div className="py-6 text-[12.5px] text-ink-400">Sin datos todavía.</div>
              )}
              {r.topCompanies.map((c) => (
                <div key={c.name} className="hair-t flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.name}</span>
                  <span className="tnum text-[11px] text-ink-400">{c.deals}</span>
                  <span className="tnum w-[74px] text-right text-[12.5px] font-semibold text-gold">
                    {eurCompact(c.won + c.open)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* motivos de pérdida */}
          <div className="panel px-5 pb-3 pt-[20px]">
            <div className="text-[14px] font-semibold tracking-[-0.01em]">
              Motivos de pérdida
            </div>
            <div className="mt-3">
              {r.lossReasons.length === 0 && (
                <div className="py-6 text-[12.5px] text-ink-400">
                  Todavía no has marcado ningún deal como perdido.
                </div>
              )}
              {r.lossReasons.map((l) => (
                <div key={l.reason} className="hair-t py-2.5">
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span className="truncate text-ink-150">{l.reason}</span>
                    <span className="tnum text-ink-400">{l.count}</span>
                  </div>
                  <div className="h-[6px] overflow-hidden rounded-[3px] bg-ink-800">
                    <div className="h-full bg-[#7A3A3A]" style={{ width: l.w }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* por tipo */}
          <div className="panel px-5 pb-3 pt-[20px]">
            <div className="text-[14px] font-semibold tracking-[-0.01em]">
              Por tipo de proyecto
            </div>
            <div className="mt-3">
              {r.byType.length === 0 && (
                <div className="py-6 text-[12.5px] text-ink-400">Sin datos todavía.</div>
              )}
              {r.byType.map((x) => (
                <div key={x.name} className="hair-t flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{x.name}</span>
                  <span className="tnum text-[11px] text-ink-400">
                    {x.won}/{x.count}
                  </span>
                  <span className="tnum w-[74px] text-right text-[12.5px] font-semibold">
                    {eurCompact(x.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* actividad */}
        <div className="panel mt-4 px-6 pb-6 pt-[22px]">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.01em]">
                Volumen de actividad
              </div>
              <div className="mt-1 text-[12px] text-ink-400">
                Llamadas, emails, reuniones y notas por mes
              </div>
            </div>
            <Link href="/activity">Ver feed</Link>
          </div>
          <div className="mt-5 flex h-[120px] items-end gap-2">
            {r.activityRows.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    title={`${b.count} actividades`}
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: b.h,
                      background: i === r.activityRows.length - 1 ? GOLD : "#2E2E2E",
                    }}
                  />
                </div>
                <span className="text-[10px] capitalize text-ink-450">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
