"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addActivity } from "@/app/actions";
import { ACTIVITY_KINDS } from "@/lib/constants";

export default function AddActivity({
  contactId,
  dealId,
}: {
  contactId?: string;
  dealId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel p-[22px]">
      <div className="text-[14px] font-semibold">Añadir actividad</div>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (contactId) fd.set("contact_id", contactId);
          if (dealId) fd.set("deal_id", dealId);
          start(async () => {
            setError(null);
            const res = await addActivity(fd);
            if (res?.error) setError(res.error);
            else {
              formRef.current?.reset();
              router.refresh();
            }
          });
        }}
      >
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <select name="kind" className="field" defaultValue="Nota">
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            name="occurred_at"
            type="datetime-local"
            className="field"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <input name="title" className="field mt-2.5" placeholder="Título de la actividad" />
        <textarea
          name="body"
          placeholder="Escribe lo que ha pasado en la llamada…"
          className="mt-2.5 min-h-[84px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-3 py-[11px] text-[12.5px] leading-[1.5] text-ink-50 outline-none focus:border-gold"
        />
        {error && <div className="mt-2 text-[12px] text-gold">{error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 w-full rounded-[9px] border border-[rgba(250,197,28,0.35)] bg-ink-800 px-3 py-2.5 text-[12.5px] font-semibold text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink-950 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar actividad"}
        </button>
      </form>
    </div>
  );
}
