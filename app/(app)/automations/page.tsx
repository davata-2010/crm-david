"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import { NewWorkflowButton } from "@/components/NewWorkflowButton";
import { useData, useSession } from "@/components/SessionGate";
import { GOLD } from "@/lib/constants";
import { relative } from "@/lib/format";
import { TRIGGERS, type RunRow, type WorkflowRow } from "@/lib/workflows";
import { workflowHref } from "@/lib/routes";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  done: "#8CE6B4",
  waiting: GOLD,
  running: "#8FC7FF",
  error: "#FF8F7A",
};

const STATUS_LABEL: Record<string, string> = {
  done: "completada",
  waiting: "esperando",
  running: "en curso",
  error: "error",
};

export default function AutomationsPage() {
  const s = useSession();
  const { data } = useData(async (s) => {
    const [{ data: flows }, { data: runs }] = await Promise.all([
      s.supabase.from("workflows").select("*").order("created_at", { ascending: false }),
      s.supabase
        .from("workflow_runs")
        .select("*, workflow:workflows(name)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    return {
      list: (flows ?? []) as WorkflowRow[],
      history: (runs ?? []) as (RunRow & { workflow: { name: string } | null })[],
    };
  });

  if (!data) return <PageSkeleton />;
  const { list, history } = data;

  return (
    <>
      <PageHeader
        crumb="Automatización"
        title="Automatizaciones"
        subtitle={`${list.filter((f) => f.active).length} activas de ${list.length}`}
        action={s.canWrite ? <NewWorkflowButton /> : null}
      />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-3">
            {list.length === 0 && (
              <div className="panel px-6 py-14 text-center">
                <div className="text-[15px] font-semibold">Sin automatizaciones todavía</div>
                <p className="mx-auto mt-2 max-w-[440px] text-[12.5px] leading-[1.6] text-ink-350">
                  Una automatización es «cuando pase esto, haz esto otro». Por ejemplo: cuando un
                  deal llegue a Propuesta, esperar 3 días, crear una tarea de seguimiento y
                  etiquetar al contacto.
                </p>
              </div>
            )}

            {list.map((f) => {
              const t = TRIGGERS.find((x) => x.key === f.trigger);
              return (
                <Link
                  key={f.id}
                  href={workflowHref(f.id)}
                  className="panel px-5 py-4 text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.35)] hover:text-ink-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-[8px] w-[8px] shrink-0 rounded-full"
                      style={{ background: f.active ? GOLD : "#3A3A3A" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {f.name}
                    </span>
                    <span className="tnum text-[11px] text-ink-400">{f.runs_count} veces</span>
                  </div>
                  <div className="mt-1.5 pl-[20px] text-[11.5px] text-ink-400">
                    {t?.label ?? f.trigger} · {f.steps?.length ?? 0} pasos
                    {f.last_run_at ? ` · última ${relative(f.last_run_at)}` : ""}
                  </div>
                  {f.description && (
                    <div className="mt-1 pl-[20px] text-[11.5px] text-ink-350">
                      {f.description}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="panel px-5 pb-3 pt-[18px]">
            <div className="text-[14px] font-semibold">Ejecuciones recientes</div>
            <div className="mt-2">
              {history.length === 0 && (
                <p className="py-6 text-[12.5px] text-ink-400">
                  Aquí aparecerá cada disparo, con su detalle paso a paso.
                </p>
              )}
              {history.map((r) => (
                <div key={r.id} className="hair-t py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[r.status] ?? "#3A3A3A" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {r.workflow?.name ?? "—"}
                    </span>
                    <span className="text-[10.5px] text-ink-450">{relative(r.created_at)}</span>
                  </div>
                  <div className="mt-[2px] pl-[15px] text-[11px] text-ink-400">
                    {r.record_label || "registro"} ·{" "}
                    {r.status === "waiting" && r.resume_at
                      ? `esperando hasta ${new Date(r.resume_at).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : r.status === "error"
                        ? r.error ?? "error"
                        : `${STATUS_LABEL[r.status]} · ${r.log?.length ?? 0} pasos`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
