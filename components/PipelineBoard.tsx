"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { moveDealStage } from "@/app/actions";
import { GOLD, STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import { eur, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

export default function PipelineBoard({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [items, setItems] = useState(deals);
  const [dragId, setDragId] = useState<string | null>(null);
  const lastDragEnd = useRef(0);
  const [, start] = useTransition();

  // El realtime refresca el server component: resincronizamos el estado local.
  useEffect(() => setItems(deals), [deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const byStage = (i: number) => items.filter((d) => d.stage === i);
  const pipelineTotal = items
    .filter((d) => d.stage < 5)
    .reduce((a, d) => a + Number(d.value), 0);

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    lastDragEnd.current = Date.now();
    const overId = e.over?.id;
    if (overId === undefined || overId === null) return;
    const stage = Number(String(overId).replace("stage-", ""));
    const id = String(e.active.id);
    const deal = items.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;

    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    start(async () => {
      const res = await moveDealStage(id, stage);
      if (res?.error) setItems(deals);
      router.refresh();
    });
  }

  const active = items.find((d) => d.id === dragId) || null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="mb-5 flex items-center gap-[18px]">
        <div className="text-[13px] text-ink-300">
          Arrastra las tarjetas entre etapas para actualizar el deal.
        </div>
        <div className="flex-1" />
        <div className="text-[13px]">
          <span className="text-ink-400">Total pipeline</span>
          <span className="ml-1.5 font-semibold text-gold">{eur(pipelineTotal)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(6,minmax(190px,1fr))] items-start gap-3">
        {STAGES.map((name, i) => (
          <Column
            key={name}
            index={i}
            name={name}
            deals={byStage(i)}
            dragId={dragId}
            lastDragEnd={lastDragEnd}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? <Card deal={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  index,
  name,
  deals,
  dragId,
  lastDragEnd,
}: {
  index: number;
  name: string;
  deals: Deal[];
  dragId: string | null;
  lastDragEnd: React.MutableRefObject<number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${index}` });
  const won = index === 5;
  const total = deals.reduce((a, d) => a + Number(d.value), 0);

  return (
    <div
      ref={setNodeRef}
      className="min-h-[400px] rounded-xl2 px-[11px] pb-[11px] pt-3.5 transition-colors"
      style={{
        background: isOver ? "rgba(250,197,28,0.07)" : won ? "rgba(250,197,28,0.04)" : "#0E0E0E",
        border: `1px dashed ${
          isOver ? GOLD : won ? "rgba(250,197,28,0.28)" : "rgba(245,245,245,0.08)"
        }`,
      }}
    >
      <div className="flex items-center gap-[7px] px-[3px] pb-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: index >= 4 ? GOLD : "#3A3A3A" }}
        />
        <span className="flex-1 text-[12px] font-semibold">{name}</span>
        <span className="tnum text-[11px] text-ink-350">{deals.length}</span>
      </div>
      <div className="tnum px-[3px] pb-3 text-[11px] tracking-[0.04em] text-ink-400">
        {eur(total)} · {STAGE_PROBABILITY[index]}%
      </div>
      <div className="flex flex-col gap-[9px]">
        {deals.map((d) => (
          <Draggable key={d.id} deal={d} dimmed={dragId === d.id} lastDragEnd={lastDragEnd} />
        ))}
      </div>
    </div>
  );
}

function Draggable({
  deal,
  dimmed,
  lastDragEnd,
}: {
  deal: Deal;
  dimmed: boolean;
  lastDragEnd: React.MutableRefObject<number>;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => {
        // Ignora el "click" sintético que sigue a un drop.
        if (Date.now() - lastDragEnd.current < 250) return;
        router.push(`/deals/${deal.id}`);
      }}
      style={{ opacity: dimmed ? 0.4 : 1 }}
      className="cursor-grab outline-none active:cursor-grabbing"
    >
      <Card deal={deal} />
    </div>
  );
}

function Card({ deal, overlay }: { deal: Deal; overlay?: boolean }) {
  const heat =
    deal.stage >= 4 ? GOLD : Number(deal.value) >= 60000 ? "#6E6E6E" : "#3A3A3A";
  return (
    <div
      className="rounded-[11px] border border-[rgba(245,245,245,0.08)] bg-ink-800 px-[13px] pb-3 pt-[13px] transition-colors hover:border-[rgba(250,197,28,0.45)]"
      style={overlay ? { boxShadow: "0 12px 30px rgba(0,0,0,0.55)", cursor: "grabbing" } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 text-[13px] font-semibold leading-[1.3] tracking-[-0.01em]">
          {deal.name}
        </div>
        <div
          className="mt-[5px] h-[5px] w-[5px] rounded-full"
          style={{ background: heat }}
        />
      </div>
      <div className="mt-[5px] text-[11.5px] text-ink-350">
        {deal.company?.name || "Sin empresa"}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="tnum text-[13px] font-semibold text-gold">
          {eur(Number(deal.value))}
        </span>
        <span className="text-[10.5px] text-ink-400">{shortDate(deal.close_date)}</span>
      </div>
      <div className="mt-[11px] flex items-center gap-[7px] border-t border-[rgba(245,245,245,0.06)] pt-2.5">
        <div className="grid h-[21px] w-[21px] place-items-center rounded-full bg-ink-700 text-[9.5px] font-semibold text-ink-150">
          {deal.owner_initials || "—"}
        </div>
        <span className="flex-1 text-[11px] text-ink-400">{deal.project_type}</span>
        <span className="text-[10.5px] text-ink-350">
          {STAGE_PROBABILITY[deal.stage]}%
        </span>
      </div>
    </div>
  );
}
