"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompany, updateCompany, deleteCompany } from "@/app/actions";
import type { Company } from "@/lib/types";

export default function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const res = company ? await updateCompany(company.id, fd) : await createCompany(fd);
          if (res?.error) setError(res.error);
          else {
            if (!company) formRef.current?.reset();
            router.push("/companies");
            router.refresh();
          }
        });
      }}
      className="grid gap-3.5"
    >
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">
          Nombre ·
        </div>
        <input name="name" className="field" defaultValue={company?.name} required placeholder="Northbeam" />
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">
            Sector
          </div>
          <input
            name="industry"
            className="field"
            defaultValue={company?.industry ?? ""}
            placeholder="Logística"
          />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">Web</div>
          <input
            name="website"
            className="field"
            defaultValue={company?.website ?? ""}
            placeholder="northbeam.io"
          />
        </div>
      </div>
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">Notas</div>
        <textarea
          name="notes"
          defaultValue={company?.notes ?? ""}
          className="min-h-[72px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] py-3 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-gold"
        />
      </div>

      {error && <div className="text-[12px] text-gold">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {pending ? "Guardando…" : company ? "Guardar" : "Añadir empresa"}
        </button>
        {company && (
          <>
            <button
              type="button"
              onClick={() => router.push("/companies")}
              className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 transition-colors hover:text-gold"
            >
              Cancelar
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => {
                if (!confirm(`¿Eliminar ${company.name}?`)) return;
                start(async () => {
                  const res = await deleteCompany(company.id);
                  if (res?.error) setError(res.error);
                  else {
                    router.push("/companies");
                    router.refresh();
                  }
                });
              }}
              className="text-[12.5px] text-ink-350 transition-colors hover:text-gold"
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </form>
  );
}
