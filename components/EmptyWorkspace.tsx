"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { seedDemoData } from "@/app/seed";

export default function EmptyWorkspace() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel mx-auto max-w-[560px] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] bg-gold text-[20px] font-bold text-ink-950">
        A
      </div>
      <h2 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">
        Tu workspace está vacío
      </h2>
      <p className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-[1.6] text-ink-350">
        Crea tu primer contacto y tu primer deal, o carga el set de datos de ejemplo de la
        agencia para ver el CRM funcionando de punta a punta.
      </p>

      {error && (
        <div className="mt-5 rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await seedDemoData();
              if (res?.error) setError(res.error);
              else router.refresh();
            })
          }
          className="rounded-[10px] bg-gold px-5 py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {pending ? "Cargando…" : "Cargar datos de ejemplo"}
        </button>
        <Link
          href="/contacts/new"
          className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-5 py-3 text-[13.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        >
          Crear contacto
        </Link>
      </div>
    </div>
  );
}
