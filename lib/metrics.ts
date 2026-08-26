import { GOLD, LOST, OPEN_STAGES, STAGES, STAGE_PROBABILITY, WON } from "./constants";
import { eur, eurCompact } from "./format";
import type { Activity, Company, Deal } from "./types";

export type Bar = { h: string; color: string };

export const isOpen = (d: Deal) => OPEN_STAGES.includes(d.stage);
export const isWon = (d: Deal) => d.stage === WON;
export const isLost = (d: Deal) => d.stage === LOST;

/** 12 cubetas mensuales (la última es el mes en curso). */
function monthBuckets() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("es-ES", { month: "short" }),
      value: 0,
      count: 0,
    };
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

export function weightedValue(d: Deal) {
  return (Number(d.value) * STAGE_PROBABILITY[d.stage]) / 100;
}

/* ============================================================== dashboard */

export function buildDashboard(
  deals: Deal[],
  activities: Pick<Activity, "deal_id" | "occurred_at">[],
  activityTotal?: number
) {
  const open = deals.filter(isOpen);
  const won = deals.filter(isWon);
  const lost = deals.filter(isLost);
  const pipelineTotal = open.reduce((a, d) => a + Number(d.value), 0);
  const weightedTotal = open.reduce((a, d) => a + weightedValue(d), 0);

  const now = new Date();
  const closedYear = (d: Deal) => new Date(d.closed_at || d.updated_at).getFullYear();
  const revenue = won
    .filter((d) => closedYear(d) === now.getFullYear())
    .reduce((a, d) => a + Number(d.value), 0);
  const revenuePrev = won
    .filter((d) => closedYear(d) === now.getFullYear() - 1)
    .reduce((a, d) => a + Number(d.value), 0);

  const D30 = Date.now() - 30 * 86_400_000;
  const D60 = Date.now() - 60 * 86_400_000;
  const created30 = deals.filter((d) => new Date(d.created_at).getTime() >= D30).length;
  const created60 = deals.filter((d) => {
    const t = new Date(d.created_at).getTime();
    return t >= D60 && t < D30;
  }).length;

  const decided = won.length + lost.length;
  const closeRate = decided ? (won.length / decided) * 100 : 0;

  const cycleDays = won
    .map((d) =>
      Math.round(
        (new Date(d.closed_at || d.updated_at).getTime() - new Date(d.created_at).getTime()) /
          86_400_000
      )
    )
    .filter((n) => n > 0);
  const avgCycle = cycleDays.length
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : 0;

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
      href: "/reports",
    },
    {
      label: "Deals activos",
      value: String(open.length),
      sub: eur(pipelineTotal) + " en pipeline",
      delta: created30 ? `+${created30}` : "0",
      deltaColor: created30 >= created60 ? GOLD : "#8A8A8A",
      bars: toBars(newBuckets.map((b) => b.count)),
      href: "/pipeline",
    },
    {
      label: "Tasa de cierre",
      value: closeRate.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "%",
      sub: `${won.length} ganados · ${lost.length} perdidos`,
      delta: decided ? `${decided} cerrados` : "—",
      deltaColor: closeRate >= 30 ? GOLD : "#8A8A8A",
      bars: toBars(wonBuckets.map((b) => b.count)),
      href: "/reports",
    },
    {
      label: "Forecast ponderado",
      value: eurCompact(weightedTotal),
      sub: avgCycle ? `Ciclo medio ${avgCycle} d` : "Sin ciclo aún",
      delta: `${activityTotal ?? activities.length} act.`,
      deltaColor: "#8A8A8A",
      bars: toBars(actBuckets.map((b) => b.count)),
      href: "/reports",
    },
  ];

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
      color: i === LOST ? "#7A3A3A" : i >= 4 ? GOLD : "#3A3A3A",
    };
  });

  return {
    open,
    won,
    lost,
    pipelineTotal,
    weightedTotal,
    avgCycle,
    closeRate,
    kpis,
    stageBars,
  };
}

/** Deals que necesitan atención: sin actividad 14 días o cierre inminente. */
export function needsAttention(
  deals: Deal[],
  activities: Pick<Activity, "deal_id" | "occurred_at">[]
) {
  const lastByDeal = new Map<string, number>();
  activities.forEach((a) => {
    if (!a.deal_id) return;
    const t = new Date(a.occurred_at).getTime();
    if (t > Date.now()) return;
    lastByDeal.set(a.deal_id, Math.max(lastByDeal.get(a.deal_id) ?? 0, t));
  });

  return deals
    .filter(isOpen)
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
    .slice(0, 6);
}

/* ================================================================ informes */

export function buildReports(deals: Deal[], activities: Activity[], companies: Company[]) {
  const won = deals.filter(isWon);
  const lost = deals.filter(isLost);
  const open = deals.filter(isOpen);

  // Embudo: cuántos deals han alcanzado al menos cada etapa.
  const funnel = OPEN_STAGES.concat(WON).map((stage) => {
    // Un deal "alcanzó" la etapa si está en ella o más allá. Los perdidos salen del embudo.
    const reached = deals.filter((d) => d.stage >= stage && d.stage !== LOST).length;
    return {
      stage,
      name: STAGES[stage],
      count: reached,
      value: deals
        .filter((d) => d.stage >= stage && d.stage !== LOST)
        .reduce((a, d) => a + Number(d.value), 0),
    };
  });
  const funnelMax = Math.max(...funnel.map((f) => f.count), 1);
  const funnelRows = funnel.map((f) => ({
    ...f,
    w: Math.max(2, (f.count / funnelMax) * 100).toFixed(0) + "%",
    conversion:
      funnel[0].count > 0
        ? ((f.count / funnel[0].count) * 100).toLocaleString("es-ES", {
            maximumFractionDigits: 0,
          }) + "%"
        : "—",
  }));

  // Ingresos por mes (12 meses).
  const revenue = monthBuckets();
  won.forEach((d) => {
    const i = bucketIndex(revenue, d.closed_at || d.updated_at);
    if (i >= 0) {
      revenue[i].value += Number(d.value);
      revenue[i].count += 1;
    }
  });
  const revenueMax = Math.max(...revenue.map((b) => b.value), 1);
  const revenueRows = revenue.map((b) => ({
    label: b.label,
    value: b.value,
    count: b.count,
    h: Math.max(2, (b.value / revenueMax) * 100).toFixed(0) + "%",
  }));

  // Ranking de empresas por valor total.
  const byCompany = new Map<string, { name: string; open: number; won: number; deals: number }>();
  deals.forEach((d) => {
    const name = d.company?.name || "Sin empresa";
    const key = d.company_id ?? "none";
    const row = byCompany.get(key) ?? { name, open: 0, won: 0, deals: 0 };
    row.deals += 1;
    if (isOpen(d)) row.open += Number(d.value);
    if (isWon(d)) row.won += Number(d.value);
    byCompany.set(key, row);
  });
  const topCompanies = Array.from(byCompany.values())
    .sort((a, b) => b.won + b.open - (a.won + a.open))
    .slice(0, 8);

  // Motivos de pérdida.
  const lossMap = new Map<string, number>();
  lost.forEach((d) => {
    const r = d.lost_reason?.trim() || "Sin motivo";
    lossMap.set(r, (lossMap.get(r) ?? 0) + 1);
  });
  const lossReasons = Array.from(lossMap.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      w: Math.max(3, (count / Math.max(lost.length, 1)) * 100).toFixed(0) + "%",
    }))
    .sort((a, b) => b.count - a.count);

  // Por tipo de proyecto.
  const typeMap = new Map<string, { count: number; value: number; won: number }>();
  deals.forEach((d) => {
    const row = typeMap.get(d.project_type) ?? { count: 0, value: 0, won: 0 };
    row.count += 1;
    row.value += Number(d.value);
    if (isWon(d)) row.won += 1;
    typeMap.set(d.project_type, row);
  });
  const byType = Array.from(typeMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);

  // Volumen de actividad por mes.
  const act = monthBuckets();
  activities.forEach((a) => {
    const i = bucketIndex(act, a.occurred_at);
    if (i >= 0) act[i].count += 1;
  });
  const actMax = Math.max(...act.map((b) => b.count), 1);
  const activityRows = act.map((b) => ({
    label: b.label,
    count: b.count,
    h: Math.max(2, (b.count / actMax) * 100).toFixed(0) + "%",
  }));

  const decided = won.length + lost.length;

  return {
    funnelRows,
    revenueRows,
    topCompanies,
    lossReasons,
    byType,
    activityRows,
    totals: {
      won: won.reduce((a, d) => a + Number(d.value), 0),
      lostValue: lost.reduce((a, d) => a + Number(d.value), 0),
      openValue: open.reduce((a, d) => a + Number(d.value), 0),
      weighted: open.reduce((a, d) => a + weightedValue(d), 0),
      winRate: decided ? (won.length / decided) * 100 : 0,
      wonCount: won.length,
      lostCount: lost.length,
      openCount: open.length,
      companies: companies.length,
      avgDeal: won.length
        ? won.reduce((a, d) => a + Number(d.value), 0) / won.length
        : 0,
    },
  };
}

/* ================================================================== tareas */

export function splitTasks(activities: Activity[]) {
  const tasks = activities.filter((a) => a.due_date);
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(endOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const pending = tasks.filter((t) => !t.completed);
  return {
    overdue: pending
      .filter((t) => new Date(t.due_date!).getTime() < now)
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!)),
    today: pending.filter((t) => {
      const d = new Date(t.due_date!).getTime();
      return d >= now && d <= endOfToday.getTime();
    }),
    week: pending
      .filter((t) => {
        const d = new Date(t.due_date!).getTime();
        return d > endOfToday.getTime() && d <= endOfWeek.getTime();
      })
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!)),
    later: pending
      .filter((t) => new Date(t.due_date!).getTime() > endOfWeek.getTime())
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!)),
    done: tasks
      .filter((t) => t.completed)
      .sort((a, b) => +new Date(b.completed_at || b.due_date!) - +new Date(a.completed_at || a.due_date!))
      .slice(0, 25),
    pendingCount: pending.length,
  };
}

export { STAGES };
