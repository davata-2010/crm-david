"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { wipeWorkspace } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, toCsv } from "@/lib/csv";
import { STAGES } from "@/lib/constants";

const named = (v: unknown) => (v as { name?: string } | null)?.name ?? "";

export default function DataSettings({
  counts,
  isAdmin,
}: {
  counts: Record<string, number>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useChrome();
  const [pending, start] = useTransition();

  async function exportAll() {
    const supabase = createClient();
    const [c, co, d, a] = await Promise.all([
      supabase.from("contacts").select("*, company:companies(name)").is("deleted_at", null),
      supabase.from("companies").select("*").is("deleted_at", null),
      supabase.from("deals").select("*, company:companies(name), contact:contacts(name)").is("deleted_at", null),
      supabase.from("activities").select("*").is("deleted_at", null),
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    let files = 0;

    if (c.data?.length) {
      downloadCsv(
        `contactos-${stamp}.csv`,
        toCsv(
          c.data.map((r) => ({
            nombre: r.name,
            email: r.email ?? "",
            telefono: r.phone ?? "",
            cargo: r.role ?? "",
            empresa: named(r.company),
            estado: r.status,
            etiquetas: (r.tags ?? []).join("; "),
            origen: r.source ?? "",
            alta: r.created_at,
          }))
        )
      );
      files++;
    }

    if (co.data?.length) {
      downloadCsv(
        `empresas-${stamp}.csv`,
        toCsv(
          co.data.map((r) => ({
            nombre: r.name,
            sector: r.industry ?? "",
            web: r.website ?? "",
            pais: r.country ?? "",
            tamano: r.size ?? "",
            notas: r.notes ?? "",
          }))
        )
      );
      files++;
    }

    if (d.data?.length) {
      downloadCsv(
        `deals-${stamp}.csv`,
        toCsv(
          d.data.map((r) => ({
            nombre: r.name,
            empresa: named(r.company),
            contacto: named(r.contact),
            valor: r.value,
            etapa: STAGES[r.stage],
            tipo: r.project_type,
            cierre: r.close_date ?? "",
            motivo_perdida: r.lost_reason ?? "",
            etiquetas: (r.tags ?? []).join("; "),
          }))
        )
      );
      files++;
    }

    if (a.data?.length) {
      downloadCsv(
        `actividades-${stamp}.csv`,
        toCsv(
          a.data.map((r) => ({
            fecha: r.occurred_at,
            tipo: r.kind,
            titulo: r.title,
            detalle: r.body ?? "",
            autor: r.author ?? "",
            vencimiento: r.due_date ?? "",
            completada: r.completed ? "sí" : "no",
          }))
        )
      );
      files++;
    }

    if (files) toast(`${files} ficheros CSV descargados.`);
    else toast("No hay datos que exportar.", "error");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Exportar datos</div>
        <div className="mt-1 text-[12.5px] text-ink-350">
          Descarga todo tu workspace en CSV: un fichero por tabla, listo para Excel o Sheets.
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(counts).map(([label, n]) => (
            <div key={label} className="rounded-[10px] border border-hair bg-ink-800 px-4 py-3">
              <div className="text-[10.5px] uppercase tracking-[0.09em] text-ink-350">
                {label}
              </div>
              <div className="tnum mt-1 text-[18px] font-semibold">{n}</div>
            </div>
          ))}
        </div>
        <button
          onClick={exportAll}
          className="mt-4 rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
        >
          Exportar todo a CSV
        </button>
      </div>

      {isAdmin && (
      <div className="rounded-xl2 border border-[rgba(255,143,122,0.28)] bg-[rgba(255,143,122,0.04)] p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em] text-[#FF8F7A]">
          Zona peligrosa
        </div>
        <div className="mt-1 text-[12.5px] leading-[1.6] text-ink-250">
          Vaciar el workspace borra todos los contactos, empresas, deals y actividades, incluida
          la papelera. Las cuentas y los perfiles del equipo se conservan. No se puede deshacer:
          exporta antes si quieres una copia.
        </div>
        <button
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: "Vaciar el workspace",
              message:
                "Se borrarán TODOS los contactos, empresas, deals y actividades. Esta acción no se puede deshacer.",
              confirmLabel: "Vaciar todo",
              danger: true,
            });
            if (!ok) return;
            const twice = await confirm({
              title: "¿Seguro del todo?",
              message: "Última confirmación antes de borrar todos los datos del workspace.",
              confirmLabel: "Sí, borrar todo",
              danger: true,
            });
            if (!twice) return;
            start(async () => {
              const res = await wipeWorkspace();
              if (res?.error) toast(res.error, "error");
              else {
                toast("Workspace vaciado.");
                router.push("/");
                router.refresh();
              }
            });
          }}
          className="mt-4 rounded-[10px] border border-[rgba(255,143,122,0.4)] px-5 py-2.5 text-[13px] font-semibold text-[#FF8F7A] transition-colors hover:bg-[#FF8F7A] hover:text-ink-950 disabled:opacity-50"
        >
          {pending ? "Borrando…" : "Vaciar workspace"}
        </button>
      </div>
      )}
    </div>
  );
}
