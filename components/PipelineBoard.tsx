"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { useChrome, type MenuItem } from "@/components/AppChrome";
import Tag from "@/components/Tag";
import { deleteDeal, duplicateDeal, moveDealStage } from "@/app/actions";
import {
  GOLD,
  LOST,
  LOST_REASONS,
  PROJECT_TYPES,
  STAGES,
  STAGE_PROBABILITY,
  WON,
} from "@/lib/constants";
import { eur, shortDate } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Deal } from "@/lib/types";

export default function PipelineBoard({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [items, setItems] = useState(deals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, start] = useTransition();

  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [q, setQ] = useState("");
  const [weighted, setWeighted] = useState(false);
  const [showClosed, setShowClosed] = useState(true);

  const lastDragEnd = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => setItems(deals), [deals]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((d) => d.tags ?? []))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((d) => {
      if (type !== "all" && d.project_type !== type) return false;
      if (tag !== "all" && !(d.tags ?? []).includes(tag)) return false;
      if (!term) return true;
      return `${d.name} ${d.company?.name ?? ""} ${d.contact?.name ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [items, type, tag, q]);

  const stagesShown = showClosed ? STAGES.map((_, i) => i) : [0, 1, 2, 3, 4];
  const byStage = (i: number) => filtered.filter((d) => d.stage === i);
  const val = (d: Deal) =>
    weighted ? (Number(d.value) * STAGE_PROBABILITY[d.stage]) / 100 : Number(d.value);
  const pipelineTotal = filtered.filter((d) => d.stage < 5).reduce((a, d) => a + val(d), 0);

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

  /** Al soltar en "Cerrado perdido" pedimos el motivo con el propio menú. */
  function askLostReason(id: string) {
    const evt = new MouseEvent("contextmenu", {
      clientX: pointer.current.x,
      clientY: pointer.current.y,
    });
    openMenu(evt, [
      { kind: "label", label: "Motivo de la pérdida" },
      ...LOST_REASONS.map((reason) => ({
        label: reason,
        icon: "○",
        onSelect: () => run(() => moveDealStage(id, LOST, reason), "Marcado como perdido."),
      })),
      { kind: "separator" },
      {
        label: "Sin especificar",
        icon: "—",
        onSelect: () => run(() => moveDealStage(id, LOST, ""), "Marcado como perdido."),
      },
    ]);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    lastDragEnd.current = Date.now();
    const overId = e.over?.id;
    if (overId == null) return;
    const stage = Number(String(overId).replace("stage-", ""));
    const id = String(e.active.id);
    const deal = items.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;

    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));

    if (stage === LOST) {
      askLostReason(id);
      return;
    }
    start(async () => {
      const res = await moveDealStage(id, stage);
      if (res?.error) {
        setItems(deals);
        toast(res.error, "error");
      } else {
        toast(`Movido a ${STAGES[stage]}.`);
        router.refresh();
      }
    });
  }

  function cardMenu(d: Deal): MenuItem[] {
    return [
      { kind: "label", label: d.name },
      { label: "Abrir deal", icon: "↗", onSelect: () => router.push(`/deals/${d.id}`) },
      {
        label: "Abrir en pestaña nueva",
        icon: "⧉",
        onSelect: () => window.open(`/deals/${d.id}`, "_blank"),
      },
      { label: "Editar", icon: "✎", onSelect: () => router.push(`/deals/${d.id}?edit=1`) },
      {
        label: "Duplicar",
        icon: "⧉",
        onSelect: () => run(() => duplicateDeal(d.id), "Deal duplicado."),
      },
      { kind: "separator" },
      {
        label: "Abrir contacto",
        icon: "◍",
        disabled: !d.contact_id,
        onSelect: () => router.push(`/contacts/${d.contact_id}`),
      },
      {
        label: "Añadir tarea",
        icon: "✓",
        onSelect: () => router.push(`/deals/${d.id}?task=1`),
      },
      {
        label: "Copiar valor",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(String(d.value));
          toast("Valor copiado.");
        },
      },
      { kind: "separator" },
      { kind: "label", label: "Mover a etapa" },
      ...STAGES.map((label, i) => ({
        label,
        icon: d.stage === i ? "●" : "○",
        disabled: d.stage === i,
        onSelect: () =>
          i === LOST
            ? askLostReason(d.id)
            : run(() => moveDealStage(d.id, i), `Movido a ${label}.`),
      })),
      { kind: "separator" },
      {
        label: "Eliminar deal",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `Eliminar "${d.name}"`,
            message: "Se borrarán también sus actividades. No se puede deshacer.",
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteDeal(d.id), "Deal eliminado.");
        },
      },
    ];
  }

  function columnMenu(i: number): MenuItem[] {
    const list = byStage(i);
    return [
      { kind: "label", label: STAGES[i] },
      {
        label: "Nuevo deal en esta etapa",
        icon: "＋",
        onSelect: () => router.push(`/deals/new?stage=${i}`),
      },
      {
        label: `Exportar ${list.length} deals`,
        icon: "↓",
        disabled: list.length === 0,
        onSelect: () => {
          downloadCsv(
            `pipeline-${STAGES[i].toLowerCase().replace(/\s+/g, "-")}.csv`,
            toCsv(
              list.map((d) => ({
                nombre: d.name,
                empresa: d.company?.name ?? "",
                contacto: d.contact?.name ?? "",
                valor: d.value,
                etapa: STAGES[d.stage],
                tipo: d.project_type,
                cierre: d.close_date ?? "",
                etiquetas: (d.tags ?? []).join("; "),
              }))
            )
          );
          toast("Exportado.");
        },
      },
      { kind: "separator" },
      {
        label: showClosed ? "Ocultar columnas cerradas" : "Mostrar columnas cerradas",
        icon: "◫",
        onSelect: () => setShowClosed((v) => !v),
      },
      {
        label: weighted ? "Ver valor bruto" : "Ver valor ponderado",
        icon: "◔",
        onSelect: () => setWeighted((v) => !v),
      },
    ];
  }

  const active = items.find((d) => d.id === dragId) || null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
      onDragEnd={onDragEnd}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-3 py-2">
          <span className="text-[12px] text-ink-450">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar deals…"
            className="w-[160px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
        >
          <option value="all">Todos los tipos</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
          >
            <option value="all">Todas las etiquetas</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setWeighted((v) => !v)}
          className="rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors"
          style={{
            background: weighted ? GOLD : "#111111",
            color: weighted ? "#080808" : "#B4B4B4",
            border: `1px solid ${weighted ? GOLD : "rgba(245,245,245,0.1)"}`,
          }}
        >
          Ponderado
        </button>
        <button
          onClick={() => setShowClosed((v) => !v)}
          className="rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors"
          style={{
            background: showClosed ? "#111111" : "rgba(250,197,28,0.1)",
            color: showClosed ? "#B4B4B4" : GOLD,
            border: `1px solid ${showClosed ? "rgba(245,245,245,0.1)" : "rgba(250,197,28,0.35)"}`,
          }}
        >
          {showClosed ? "Ocultar cerrados" : "Solo abiertos"}
        </button>

        <div className="flex-1" />
        <div className="text-[13px]">
          <span className="text-ink-400">
            {weighted ? "Forecast ponderado" : "Total pipeline"}
          </span>
          <span className="ml-1.5 font-semibold text-gold">{eur(pipelineTotal)}</span>
        </div>
      </div>

      <div className="text-[11.5px] text-ink-500">
        Arrastra las tarjetas entre etapas · clic derecho sobre una tarjeta para el menú completo
      </div>

      <div className="mt-3 overflow-x-auto pb-3">
        <div
          className="grid items-start gap-3"
          style={{ gridTemplateColumns: `repeat(${stagesShown.length}, minmax(196px, 1fr))` }}
        >
          {stagesShown.map((i) => (
            <Column
              key={i}
              index={i}
              deals={byStage(i)}
              dragId={dragId}
              lastDragEnd={lastDragEnd}
              weighted={weighted}
              onMenu={columnMenu}
              cardMenu={cardMenu}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? <Card deal={active} overlay weighted={weighted} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  index,
  deals,
  dragId,
  lastDragEnd,
  weighted,
  onMenu,
  cardMenu,
}: {
  index: number;
  deals: Deal[];
  dragId: string | null;
  lastDragEnd: React.MutableRefObject<number>;
  weighted: boolean;
  onMenu: (i: number) => MenuItem[];
  cardMenu: (d: Deal) => MenuItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${index}` });
  const { openMenu } = useChrome();
  const won = index === WON;
  const lost = index === LOST;
  const total = deals.reduce(
    (a, d) =>
      a + (weighted ? (Number(d.value) * STAGE_PROBABILITY[d.stage]) / 100 : Number(d.value)),
    0
  );

  const base = lost ? "rgba(122,58,58,0.07)" : won ? "rgba(250,197,28,0.04)" : "#0E0E0E";
  const border = lost
    ? "rgba(122,58,58,0.4)"
    : won
      ? "rgba(250,197,28,0.28)"
      : "rgba(245,245,245,0.08)";
  const dot = lost ? "#7A3A3A" : index >= 4 ? GOLD : "#3A3A3A";

  return (
    <div
      ref={setNodeRef}
      onContextMenu={(e) => openMenu(e, onMenu(index))}
      className="min-h-[420px] rounded-xl2 px-[11px] pb-[11px] pt-3.5 transition-colors"
      style={{
        background: isOver ? "rgba(250,197,28,0.08)" : base,
        border: `1px dashed ${isOver ? GOLD : border}`,
      }}
    >
      <div className="flex items-center gap-[7px] px-[3px] pb-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        <span className="flex-1 truncate text-[12px] font-semibold">{STAGES[index]}</span>
        <span className="tnum text-[11px] text-ink-350">{deals.length}</span>
      </div>
      <div className="tnum px-[3px] pb-3 text-[11px] tracking-[0.04em] text-ink-400">
        {eur(total)}
        {!lost && ` · ${STAGE_PROBABILITY[index]}%`}
      </div>
      <div className="flex flex-col gap-[9px]">
        {deals.map((d) => (
          <Draggable
            key={d.id}
            deal={d}
            dimmed={dragId === d.id}
            lastDragEnd={lastDragEnd}
            weighted={weighted}
            menu={cardMenu}
          />
        ))}
        {deals.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-[rgba(245,245,245,0.07)] px-3 py-6 text-center text-[11px] text-ink-500">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  );
}

function Draggable({
  deal,
  dimmed,
  lastDragEnd,
  weighted,
  menu,
}: {
  deal: Deal;
  dimmed: boolean;
  lastDragEnd: React.MutableRefObject<number>;
  weighted: boolean;
  menu: (d: Deal) => MenuItem[];
}) {
  const router = useRouter();
  const { openMenu } = useChrome();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => openMenu(e, menu(deal))}
      onClick={() => {
        if (Date.now() - lastDragEnd.current < 250) return;
        router.push(`/deals/${deal.id}`);
      }}
      style={{ opacity: dimmed ? 0.4 : 1 }}
      className="cursor-grab outline-none active:cursor-grabbing"
    >
      <Card deal={deal} weighted={weighted} />
    </div>
  );
}

function Card({
  deal,
  overlay,
  weighted,
}: {
  deal: Deal;
  overlay?: boolean;
  weighted?: boolean;
}) {
  const lost = deal.stage === LOST;
  const heat = lost
    ? "#7A3A3A"
    : deal.stage >= 4
      ? GOLD
      : Number(deal.value) >= 60000
        ? "#6E6E6E"
        : "#3A3A3A";
  const shown = weighted
    ? (Number(deal.value) * STAGE_PROBABILITY[deal.stage]) / 100
    : Number(deal.value);

  const overdue =
    deal.close_date && deal.stage < 5 && new Date(deal.close_date).getTime() < Date.now();

  return (
    <div
      className="rounded-[11px] border border-[rgba(245,245,245,0.08)] bg-ink-800 px-[13px] pb-3 pt-[13px] transition-colors hover:border-[rgba(250,197,28,0.45)]"
      style={{
        opacity: lost ? 0.72 : 1,
        ...(overlay ? { boxShadow: "0 12px 30px rgba(0,0,0,0.55)", cursor: "grabbing" } : {}),
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 text-[13px] font-semibold leading-[1.3] tracking-[-0.01em]">
          {deal.name}
        </div>
        <div
          className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full"
          style={{ background: heat }}
        />
      </div>
      <div className="mt-[5px] truncate text-[11.5px] text-ink-350">
        {deal.company?.name || "Sin empresa"}
      </div>

      {(deal.tags ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(deal.tags ?? []).slice(0, 3).map((t) => (
            <Tag key={t} tag={t} small />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="tnum text-[13px] font-semibold text-gold">{eur(shown)}</span>
        <span className="text-[10.5px]" style={{ color: overdue ? "#FF8F7A" : "#6E6E6E" }}>
          {shortDate(deal.close_date)}
        </span>
      </div>

      {lost && deal.lost_reason && (
        <div className="mt-2 truncate text-[10.5px] text-[#FF8F7A]">✕ {deal.lost_reason}</div>
      )}

      <div className="mt-[11px] flex items-center gap-[7px] border-t border-[rgba(245,245,245,0.06)] pt-2.5">
        <div className="grid h-[21px] w-[21px] place-items-center rounded-full bg-ink-700 text-[9.5px] font-semibold text-ink-150">
          {deal.owner_initials || "—"}
        </div>
        <span className="flex-1 truncate text-[11px] text-ink-400">{deal.project_type}</span>
        <span className="text-[10.5px] text-ink-350">{STAGE_PROBABILITY[deal.stage]}%</span>
      </div>
    </div>
  );
}
