"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDealStage } from "@/app/actions";
import { GOLD, STAGES } from "@/lib/constants";

export default function StageSwitcher({
  dealId,
  stage,
}: {
  dealId: string;
  stage: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {STAGES.map((label, i) => {
        const active = stage === i;
        return (
          <button
            key={label}
            disabled={pending || active}
            onClick={() =>
              start(async () => {
                await moveDealStage(dealId, i);
                router.refresh();
              })
            }
            className="rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors disabled:cursor-default"
            style={{
              background: active ? GOLD : "#111111",
              color: active ? "#080808" : "#B4B4B4",
              border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
