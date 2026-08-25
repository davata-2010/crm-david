"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addActivity } from "@/app/actions";
import { ACTIVITY_KINDS, GOLD } from "@/lib/constants";
import { useChrome } from "@/components/AppChrome";

export default function AddActivity({
  contactId,
  dealId,
  startAsTask,
}: {
  contactId?: string;
  dealId?: string;
  startAsTask?: boolean;
}) {
  const router = useRouter();
  const { toast } = useChrome();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [isTask, setIsTask] = useState(!!startAsTask);

  return (
    <div className="panel p-[22px]">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[14px] font-semibold">
          {isTask ? "Nueva tarea" : "Registrar actividad"}
        </div>
        <button
          onClick={() => setIsTask((v) => !v)}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            background: isTask ? GOLD : "#111111",
            color: isTask ? "#080808" : "#B4B4B4",
            border: `1px solid ${isTask ? GOLD : "rgba(245,245,245,0.1)"}`,
          }}
        >
          {isTask ? "Es tarea" : "Marcar como tarea"}
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (contactId) fd.set("contact_id", contactId);
          if (dealId) fd.set("deal_id", dealId);
          if (!isTask) fd.delete("due_date");
          start(async () => {
            const res = await addActivity(fd);
            if (res?.error) toast(res.error, "error");
            else {
              formRef.current?.reset();
              toast(isTask ? "Tarea creada." : "Actividad registrada.");
              router.refresh();
            }
          });
        }}
      >
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <select name="kind" className="field" defaultValue={isTask ? "Tarea" : "Nota"}>
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
            title="Cuándo ocurrió"
          />
        </div>

        {isTask && (
          <div className="mt-2.5">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">
              Vencimiento ·
            </div>
            <input
              name="due_date"
              type="datetime-local"
              className="field"
              style={{ colorScheme: "dark" }}
              required
            />
          </div>
        )}

        <input name="title" className="field mt-2.5" placeholder="Título" required />
        <textarea
          name="body"
          placeholder="Escribe lo que ha pasado en la llamada…"
          className="mt-2.5 min-h-[76px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-3 py-[11px] text-[12.5px] leading-[1.5] text-ink-50 outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-3 w-full rounded-[9px] border border-[rgba(250,197,28,0.35)] bg-ink-800 px-3 py-2.5 text-[12.5px] font-semibold text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink-950 disabled:opacity-50"
        >
          {pending ? "Guardando…" : isTask ? "Crear tarea" : "Guardar actividad"}
        </button>
      </form>
    </div>
  );
}
