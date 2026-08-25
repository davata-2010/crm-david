"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteActivity } from "@/app/actions";
import { timelineWhen } from "@/lib/format";
import { GOLD } from "@/lib/constants";
import type { Activity } from "@/lib/types";

const TABS = ["Todo", "Llamadas", "Emails", "Reuniones"] as const;
type Tab = (typeof TABS)[number];

const MATCH: Record<Tab, (a: Activity) => boolean> = {
  Todo: () => true,
  Llamadas: (a) => a.kind === "Llamada",
  Emails: (a) => a.kind === "Email",
  Reuniones: (a) => a.kind === "Reunión",
};

export default function Timeline({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Todo");
  const [, start] = useTransition();

  const items = activities.filter(MATCH[tab]);

  return (
    <div className="panel px-[26px] pb-[26px] pt-6">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
          Timeline de actividades
        </div>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-full px-3 py-1.5 text-[11.5px] transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="mt-[22px] pl-1.5">
        {items.length === 0 && (
          <div className="py-6 text-[12.5px] text-ink-400">
            Sin actividades en esta vista.
          </div>
        )}
        {items.map((e, i) => (
          <div key={e.id} className="grid grid-cols-[26px_1fr] gap-4">
            <div className="flex flex-col items-center">
              <div
                className="h-[11px] w-[11px] rounded-full"
                style={{
                  border: `2px solid ${i === 0 ? GOLD : "#3A3A3A"}`,
                  background: i === 0 ? GOLD : "#080808",
                }}
              />
              <div className="min-h-[26px] w-px flex-1 bg-[rgba(245,245,245,0.09)]" />
            </div>
            <div className="group pb-6">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[13.5px] font-semibold tracking-[-0.01em]">
                  {e.title}
                </span>
                <span className="text-[11px] text-ink-400">
                  {timelineWhen(e.occurred_at)}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() =>
                    start(async () => {
                      await deleteActivity(e.id);
                      router.refresh();
                    })
                  }
                  className="text-[11px] text-ink-500 opacity-0 transition-opacity hover:text-gold group-hover:opacity-100"
                  title="Eliminar actividad"
                >
                  ✕
                </button>
              </div>
              {e.body && (
                <div className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.55] text-ink-250">
                  {e.body}
                </div>
              )}
              <div className="mt-2.5 flex gap-2">
                <span className="rounded-md border border-hair bg-ink-800 px-2 py-[3px] text-[10.5px] text-ink-350">
                  {e.kind}
                </span>
                {e.author && (
                  <span className="rounded-md border border-hair bg-ink-800 px-2 py-[3px] text-[10.5px] text-ink-350">
                    {e.author}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
