"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { exportWorkflow, syncWorkflowToN8n, useAurumEngine } from "@/app/integrations";
import { GOLD } from "@/lib/constants";
import { relative } from "@/lib/format";
import type { WorkflowRow } from "@/lib/workflows";

/**
 * Panel que decide dónde se ejecuta una automatización y la refleja fuera.
 */
export default function WorkflowEngine({
  workflow,
  n8nReady,
}: {
  workflow: WorkflowRow;
  n8nReady: boolean;
}) {
  const router = useRouter();
  const { toast } = useChrome();
  const [pending, start] = useTransition();

  const engine = workflow.engine ?? "aurum";
  const external = engine !== "aurum";

  function download(target: "n8n" | "make") {
    start(async () => {
      const res = await exportWorkflow(workflow.id, target);
      if (res.error || !res.json) return toast(res.error ?? "No se pudo generar.", "error");
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? `${target}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`JSON para ${target} descargado.`);
    });
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-gold text-[11px] font-bold text-ink-950">
          ⚙
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Dónde se ejecuta</span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <Option
          active={engine === "aurum"}
          title="Dentro de Aurum"
          detail="El propio CRM ejecuta los pasos. Sin dependencias externas y con esperas de cualquier duración."
          onClick={() =>
            start(async () => {
              const res = await useAurumEngine(workflow.id);
              if (res?.error) toast(res.error, "error");
              else {
                toast(res.info ?? "Listo.");
                router.refresh();
              }
            })
          }
        />
        <Option
          active={engine === "n8n"}
          title="En n8n"
          detail="Aurum comprueba el disparador y las condiciones, y n8n ejecuta los pasos. Puedes ampliar el workflow allí con cualquier otro nodo."
          disabled={!n8nReady}
          disabledHint="Conecta n8n en Ajustes → Integraciones"
          onClick={() =>
            start(async () => {
              const res = await syncWorkflowToN8n(workflow.id);
              if (res?.error) toast(res.error, "error");
              else {
                toast(res.info ?? "Reflejado en n8n.");
                router.refresh();
              }
            })
          }
        />
      </div>

      {external && workflow.external_url && (
        <div className="mt-3 rounded-[10px] border border-hair bg-ink-925 px-3.5 py-3">
          <div className="flex flex-wrap items-baseline gap-2 text-[11.5px]">
            <span className="text-ink-400">Reflejado como</span>
            <span className="font-medium">{workflow.external_name ?? workflow.name}</span>
            {workflow.external_synced_at && (
              <span className="text-ink-450">· {relative(workflow.external_synced_at)}</span>
            )}
          </div>
          <code className="mt-1.5 block break-all font-mono text-[10.5px] text-ink-400">
            {workflow.external_url}
          </code>
        </div>
      )}

      {workflow.external_error && (
        <div className="mt-3 rounded-[10px] border border-[rgba(255,143,122,0.3)] bg-[rgba(255,143,122,0.06)] px-3 py-2.5 text-[12px] text-[#FF8F7A]">
          {workflow.external_error}
        </div>
      )}

      <div className="mt-4 border-t border-hair pt-4">
        <div className="text-[11px] uppercase tracking-[0.1em] text-ink-350">
          Exportar el diseño
        </div>
        <p className="mt-1.5 text-[11.5px] leading-[1.6] text-ink-450">
          Descarga el workflow ya construido para importarlo a mano. En n8n:{" "}
          <em>Workflows → Import from File</em>. En Make:{" "}
          <em>Create a new scenario → Import Blueprint</em>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={pending || !workflow.steps?.length}
            onClick={() => download("n8n")}
            className="rounded-[9px] border border-[rgba(245,245,245,0.12)] px-3.5 py-2 text-[12px] text-ink-150 transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
          >
            JSON para n8n
          </button>
          <button
            disabled={pending || !workflow.steps?.length}
            onClick={() => download("make")}
            className="rounded-[9px] border border-[rgba(245,245,245,0.12)] px-3.5 py-2 text-[12px] text-ink-150 transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
          >
            Blueprint para Make
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({
  active,
  title,
  detail,
  onClick,
  disabled,
  disabledHint,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] border px-3.5 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-50"
      style={{
        borderColor: active ? "rgba(250,197,28,0.45)" : "rgba(245,245,245,0.08)",
        background: active ? "rgba(250,197,28,0.06)" : "#1A1A1A",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: active ? GOLD : "#3A3A3A" }}
        />
        <span className="text-[12.5px] font-medium" style={{ color: active ? GOLD : "#F5F5F5" }}>
          {title}
        </span>
        {active && <span className="text-[10.5px] text-ink-450">activo</span>}
      </div>
      <div className="mt-1 pl-[15px] text-[11px] leading-[1.55] text-ink-400">
        {disabled && disabledHint ? disabledHint : detail}
      </div>
    </button>
  );
}
