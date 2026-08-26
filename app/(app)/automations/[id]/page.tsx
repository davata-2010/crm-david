import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import WorkflowEditor from "@/components/WorkflowEditor";
import { getSession } from "@/lib/workspace";
import { contactFields, dealFields } from "@/lib/fields";
import { TRIGGERS, type RunRow, type WorkflowRow } from "@/lib/workflows";
import { relative } from "@/lib/format";
import type { CustomField } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: { params: { id: string } }) {
  const s = await getSession();

  const [{ data: flow }, companiesRes, contactsRes, formsRes, fieldsRes, runsRes] =
    await Promise.all([
      s.supabase.from("workflows").select("*").eq("id", params.id).maybeSingle(),
      s.supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
      s.supabase
        .from("contacts")
        .select("id, name")
        .is("deleted_at", null)
        .order("name")
        .limit(500),
      s.supabase.from("forms").select("id, name").order("created_at"),
      s.supabase.from("custom_fields").select("*"),
      s.supabase
        .from("workflow_runs")
        .select("*")
        .eq("workflow_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!flow) notFound();

  const workflow = flow as WorkflowRow;
  const custom = (fieldsRes.data ?? []) as CustomField[];
  const trigger = TRIGGERS.find((x) => x.key === workflow.trigger);

  const fields =
    trigger?.entity === "deals"
      ? dealFields(
          companiesRes.data ?? [],
          contactsRes.data ?? [],
          s.members,
          custom.filter((c) => c.entity === "deals")
        )
      : contactFields(
          companiesRes.data ?? [],
          s.members,
          custom.filter((c) => c.entity === "contacts")
        );

  const runs = (runsRes.data ?? []) as RunRow[];

  return (
    <>
      <PageHeader crumb="Automatización" title={workflow.name} />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <Link
          href="/automations"
          className="mb-4 inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Todas las automatizaciones
        </Link>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
          <WorkflowEditor
            workflow={workflow}
            fields={fields}
            members={s.members}
            forms={formsRes.data ?? []}
          />

          <div className="panel px-5 pb-3 pt-[18px]">
            <div className="text-[14px] font-semibold">Historial</div>
            <div className="mt-1 text-[11.5px] text-ink-400">
              Cada ejecución guarda qué hizo, paso a paso.
            </div>
            <div className="mt-2">
              {runs.length === 0 && (
                <p className="py-6 text-[12.5px] text-ink-400">Todavía no se ha ejecutado.</p>
              )}
              {runs.map((r) => (
                <details key={r.id} className="hair-t py-2.5">
                  <summary className="flex cursor-pointer items-baseline gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate">
                      {r.record_label || "registro"}
                    </span>
                    <span className="text-[10.5px] text-ink-450">{relative(r.created_at)}</span>
                    <span className="text-[10.5px] text-ink-400">{r.status}</span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-1 pl-2">
                    {(r.log ?? []).map((l, i) => (
                      <div key={i} className="text-[11px] text-ink-350">
                        <span className="text-ink-500">{l.step + 1}.</span> {l.action} — {l.detail}
                      </div>
                    ))}
                    {r.error && <div className="text-[11px] text-[#FF8F7A]">{r.error}</div>}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
