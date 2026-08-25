"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { deleteDeal, duplicateDeal, moveDealStage } from "@/app/actions";
import { LOST, LOST_REASONS, STAGES } from "@/lib/constants";
import type { Deal } from "@/lib/types";

export default function DealActions({ deal }: { deal: Deal }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();

  function run(fn: () => Promise<{ error?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        router.refresh();
      }
    });
  }

  function askLostReason(e: React.MouseEvent) {
    openMenu(e, [
      { kind: "label", label: "Motivo de la pérdida" },
      ...LOST_REASONS.map((reason) => ({
        label: reason,
        icon: "○",
        onSelect: () => run(() => moveDealStage(deal.id, LOST, reason), "Marcado como perdido."),
      })),
      { kind: "separator" },
      {
        label: "Sin especificar",
        icon: "—",
        onSelect: () => run(() => moveDealStage(deal.id, LOST, ""), "Marcado como perdido."),
      },
    ]);
  }

  async function doDelete() {
    const ok = await confirm({
      title: `Eliminar "${deal.name}"`,
      message: "Se borrarán también sus actividades y tareas. No se puede deshacer.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteDeal(deal.id);
      if (res?.error) toast(res.error, "error");
      else {
        toast("Deal eliminado.");
        router.push("/pipeline");
      }
    });
  }

  const items: MenuItem[] = [
    { kind: "label", label: deal.name },
    { label: "Editar", icon: "✎", onSelect: () => router.push(`/deals/${deal.id}?edit=1`) },
    {
      label: "Duplicar",
      icon: "⧉",
      onSelect: () => run(() => duplicateDeal(deal.id), "Deal duplicado."),
    },
    { label: "Añadir tarea", icon: "✓", onSelect: () => router.push(`/deals/${deal.id}?task=1`) },
    { kind: "separator" },
    { kind: "label", label: "Mover a etapa" },
    ...STAGES.map((label, i) => ({
      label,
      icon: deal.stage === i ? "●" : "○",
      disabled: deal.stage === i,
      onSelect: () => run(() => moveDealStage(deal.id, i), `Movido a ${label}.`),
    })),
    { kind: "separator" },
    { label: "Eliminar deal", icon: "✕", danger: true, onSelect: doDelete },
  ];

  return (
    <div className="flex gap-[9px]">
      <button
        onClick={askLostReason}
        className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-[14px] py-[9px] text-[12.5px] text-ink-150 transition-colors hover:border-[#FF8F7A] hover:text-[#FF8F7A]"
      >
        Marcar perdido
      </button>
      <button
        onClick={(e) => openMenu(e, items)}
        title="Más acciones"
        className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-[9px] text-[13px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
      >
        ⋯
      </button>
      <button
        onClick={doDelete}
        className="rounded-[9px] border border-[rgba(255,143,122,0.3)] bg-ink-800 px-[14px] py-[9px] text-[12.5px] text-[#FF8F7A] transition-colors hover:border-[#FF8F7A] hover:bg-[rgba(255,143,122,0.1)]"
      >
        Eliminar
      </button>
    </div>
  );
}
