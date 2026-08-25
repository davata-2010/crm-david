"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { createCompany, updateCompany, deleteCompany } from "@/app/actions";
import type { Company } from "@/lib/types";

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export default function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const pathname = usePathname();
  const { confirm, toast } = useChrome();
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
          if (res?.error) {
            setError(res.error);
            return;
          }
          toast(company ? "Empresa actualizada." : "Empresa creada.");
          if (company) {
            router.replace(pathname);
            router.refresh();
          } else {
            router.push(`/companies/${(res as { id: string }).id}`);
          }
        });
      }}
      className="grid gap-3.5"
    >
      <Field label="Nombre ·">
        <input name="name" className="field" defaultValue={company?.name} required placeholder="Northbeam" />
      </Field>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Sector">
          <input
            name="industry"
            className="field"
            defaultValue={company?.industry ?? ""}
            placeholder="Logística"
          />
        </Field>
        <Field label="Web">
          <input
            name="website"
            className="field"
            defaultValue={company?.website ?? ""}
            placeholder="northbeam.io"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="País">
          <input
            name="country"
            className="field"
            defaultValue={company?.country ?? ""}
            placeholder="España"
          />
        </Field>
        <Field label="Tamaño">
          <select name="size" className="field" defaultValue={company?.size ?? ""}>
            <option value="">Sin especificar</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} empleados
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notas">
        <textarea
          name="notes"
          defaultValue={company?.notes ?? ""}
          placeholder="Contexto de la cuenta, quién decide, historial…"
          className="min-h-[80px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] py-3 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-gold"
        />
      </Field>

      {error && <div className="text-[12px] text-gold">{error}</div>}

      <div className="mt-1 flex items-center gap-3 border-t border-hair pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {pending ? "Guardando…" : company ? "Guardar" : "Crear empresa"}
        </button>
        <button
          type="button"
          onClick={() => (company ? router.replace(pathname) : router.push("/companies"))}
          className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 transition-colors hover:text-gold"
        >
          Cancelar
        </button>
        <div className="flex-1" />
        {company && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar ${company.name}`,
                message:
                  "Sus contactos y deals se conservan, pero quedarán sin empresa asignada.",
                confirmLabel: "Eliminar",
                danger: true,
              });
              if (!ok) return;
              start(async () => {
                const res = await deleteCompany(company.id);
                if (res?.error) setError(res.error);
                else {
                  toast("Empresa eliminada.");
                  router.push("/companies");
                }
              });
            }}
            className="text-[12.5px] text-ink-350 transition-colors hover:text-gold"
          >
            Eliminar empresa
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">{label}</div>
      {children}
    </div>
  );
}
