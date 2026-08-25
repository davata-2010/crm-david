import { GOLD, STAGES, STAGE_PROBABILITY } from "./constants";
import { eur, eurCompact } from "./format";
import type { Activity, Deal } from "./types";

export type Bar = { h: string; color: string };

/** 12 cubetas mensuales (la última es el mes en curso). */
function monthBuckets() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), value: 0, count: 0 };
  });
}

function bucketIndex(buckets: ReturnType<typeof monthBuckets>, iso: string) {
  const d = new Date(iso);
  return buckets.findIndex((b) => b.year === d.getFullYear() && b.month === d.getMonth());
}

function toBars(values: number[]): Bar[] {
  const max = Math.max(...values, 0);
  return values.map((v, i) => ({
    h: max <= 0 ? "6%" : Math.max(6, (v / max) * 100).toFixed(0) + "%",
    color: i === values.length - 1 ? GOLD : "#262626",
  }));
}

const pct = (n: number) =>
  (n >= 0 ? "+" : "") + n.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "%";

export function buildDashboard(deals: Deal[], activities: Activity[]) {
  const open = deals.filter((d) => d.stage < 5);
  const won = deals.filter((d) => d.stage === 5);
  const pipelineTotal = open.reduce((a, d) => a + Number(d.value), 0);
  const weightedTotal = open.reduce(
    (a, d) => a + (Number(d.value) * STAGE_PROBABILITY[d.stage]) / 100,
    0
  );

  const now = new Date();
  const thisYear = won.filter(
    (d) => new Date(d.closed_at || d.updated_at).getFullYear() === now.getFullYear()
  );
  const lastYear = won.filter(
    (d) => new Date(d.closed_at || d.updated_at).getFullYear() === now.getFullYear() - 1
  );
  const revenue = thisYear.reduce((a, d) => a + Number(d.value), 0);
  const revenuePrev = lastYear.reduce((a, d) => a + Number(d.value), 0);

  const D30 = Date.now() - 30 * 86_400_000;
  const D60 = Date.now() - 60 * 86_400_000;
  const created30 = deals.filter((d) => new Date(d.created_at).getTime() >= D30).length;
  const created60 = deals.filter((d) => {
    const t = new Date(d.created_at).getTime();
    return t >= D60 && t < D30;
  }).length;

  const closeRate = deals.length ? (won.length / deals.length) * 100 : 0;

  const cycleDays = won
    .map((d) =>
      Math.max(
        0,
        Math.round(
          (new Date(d.closed_at || d.updated_at).getTime() -
            new Date(d.created_at).getTime()) /
            86_400_000
        )
      )
    )
    .filter((n) => n > 0);
  const avgCycle = cycleDays.length
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : 0;

  // --- sparklines con datos reales ---
  const revBuckets = monthBuckets();
  won.forEach((d) => {
    const i = bucketIndex(revBuckets, d.closed_at || d.updated_at);
    if (i >= 0) revBuckets[i].value += Number(d.value);
  });
  const newBuckets = monthBuckets();
  deals.forEach((d) => {
    const i = bucketIndex(newBuckets, d.created_at);
    if (i >= 0) newBuckets[i].count += 1;
  });
  const wonBuckets = monthBuckets();
  won.forEach((d) => {
    const i = bucketIndex(wonBuckets, d.closed_at || d.updated_at);
    if (i >= 0) wonBuckets[i].count += 1;
  });
  const actBuckets = monthBuckets();
  activities.forEach((a) => {
    const i = bucketIndex(actBuckets, a.occurred_at);
    if (i >= 0) actBuckets[i].count += 1;
  });

  const kpis = [
    {
      label: "Revenue total",
      value: eurCompact(revenue),
      sub: "Año en curso",
      delta: revenuePrev > 0 ? pct(((revenue - revenuePrev) / revenuePrev) * 100) : "—",
      deltaColor: revenuePrev > 0 && revenue >= revenuePrev ? GOLD : "#8A8A8A",
      bars: toBars(revBuckets.map((b) => b.value)),
    },
    {
      label: "Deals activos",
      value: String(open.length),
      sub: eur(pipelineTotal) + " en pipeline",
      delta: created30 ? `+${created30}` : "0",
      deltaColor: created30 >= created60 ? GOLD : "#8A8A8A",
      bars: toBars(newBuckets.map((b) => b.count)),
    },
    {
      label: "Tasa de cierre",
      value: closeRate.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "%",
      sub: `Sobre ${deals.length} deals`,
      delta: `${won.length} ganados`,
      deltaColor: closeRate >= 30 ? GOLD : "#8A8A8A",
      bars: toBars(wonBuckets.map((b) => b.count)),
    },
    {
      label: "Ciclo medio",
      value: avgCycle ? `${avgCycle} d` : "— d",
      sub: "De lead a firma",
      delta: `${activities.length} act.`,
      deltaColor: "#8A8A8A",
      bars: toBars(actBuckets.map((b) => b.count)),
    },
  ];

  // --- pipeline por etapa ---
  const stageTotals = STAGES.map((_, i) =>
    deals.filter((d) => d.stage === i).reduce((a, d) => a + Number(d.value), 0)
  );
  const maxStage = Math.max(...stageTotals, 1);
  const stageBars = STAGES.map((name, i) => {
    const list = deals.filter((d) => d.stage === i);
    return {
      name,
      amount: eur(stageTotals[i]),
      count: `${list.length} deals`,
      w: Math.max(3, (stageTotals[i] / maxStage) * 100).toFixed(0) + "%",
      color: i >= 4 ? GOLD : "#3A3A3A",
    };
  });

  return { open, won, pipelineTotal, weightedTotal, kpis, stageBars };
}

/** Deals que necesitan atención: sin actividad 14 días o cierre en <7 días. */
export function needsAttention(deals: Deal[], activities: Activity[]) {
  const lastByDeal = new Map<string, number>();
  activities.forEach((a) => {
    if (!a.deal_id) return;
    const t = new Date(a.occurred_at).getTime();
    if (t > Date.now()) return;
    lastByDeal.set(a.deal_id, Math.max(lastByDeal.get(a.deal_id) ?? 0, t));
  });

  return deals
    .filter((d) => d.stage < 5)
    .map((d) => {
      const last = lastByDeal.get(d.id) ?? new Date(d.created_at).getTime();
      const silentDays = Math.floor((Date.now() - last) / 86_400_000);
      const daysToClose = d.close_date
        ? Math.ceil((new Date(d.close_date).getTime() - Date.now()) / 86_400_000)
        : null;

      let reason: string | null = null;
      if (daysToClose !== null && daysToClose < 0) reason = `Cierre vencido ${-daysToClose} d`;
      else if (daysToClose !== null && daysToClose <= 7) reason = "Cierre esta semana";
      else if (silentDays >= 14) reason = `Sin contacto ${silentDays} días`;

      return { deal: d, reason, silentDays, daysToClose };
    })
    .filter((r) => r.reason)
    .sort((a, b) => (a.daysToClose ?? 999) - (b.daysToClose ?? 999))
    .slice(0, 5);
}

export { STAGES };
