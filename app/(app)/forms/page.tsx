"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import { NewFormButton } from "@/components/NewWorkflowButton";
import { useData, useSession } from "@/components/SessionGate";
import { GOLD } from "@/lib/constants";
import { relative } from "@/lib/format";
import type { FormRow } from "@/components/FormBuilder";
import { contactHref, formHref } from "@/lib/routes";

export default function FormsPage() {
  const s = useSession();
  const { data } = useData(async (s) => {
    const [{ data: forms }, { data: recent }] = await Promise.all([
      s.supabase.from("forms").select("*").order("created_at", { ascending: false }),
      s.supabase
        .from("form_submissions")
        .select("*, form:forms(name), contact:contacts(id,name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { list: (forms ?? []) as FormRow[], recent };
  });

  if (!data) return <PageSkeleton />;
  const { list, recent } = data;

  return (
    <>
      <PageHeader
        crumb="Captación"
        title="Formularios"
        subtitle={`${list.length} formularios · ${list.reduce((a, f) => a + f.submissions, 0)} envíos`}
        action={s.canWrite ? <NewFormButton /> : null}
      />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-3">
            {list.length === 0 && (
              <div className="panel px-6 py-14 text-center">
                <div className="text-[15px] font-semibold">Sin formularios todavía</div>
                <p className="mx-auto mt-2 max-w-[440px] text-[12.5px] leading-[1.6] text-ink-350">
                  Un formulario publica una página con su propia dirección, o se incrusta en tu
                  web. Cada envío crea el contacto en el CRM y puede disparar automatizaciones.
                </p>
              </div>
            )}

            {list.map((f) => (
              <Link
                key={f.id}
                href={formHref(f.id)}
                className="panel px-5 py-4 text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.35)] hover:text-ink-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-[8px] w-[8px] shrink-0 rounded-full"
                    style={{ background: f.active ? GOLD : "#3A3A3A" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {f.name}
                  </span>
                  <span className="tnum text-[11px] text-ink-400">{f.submissions} envíos</span>
                </div>
                <div className="mt-1.5 truncate pl-[20px] font-mono text-[11px] text-ink-400">
                  {f.slug}
                </div>
                <div className="mt-1 pl-[20px] text-[11.5px] text-ink-350">
                  {f.fields?.length ?? 0} campos
                  {f.tags?.length ? ` · etiqueta: ${f.tags.join(", ")}` : ""}
                </div>
              </Link>
            ))}
          </div>

          <div className="panel px-5 pb-3 pt-[18px]">
            <div className="text-[14px] font-semibold">Envíos recientes</div>
            <div className="mt-2">
              {(recent ?? []).length === 0 && (
                <p className="py-6 text-[12.5px] text-ink-400">
                  Todavía no ha entrado ningún lead por formulario.
                </p>
              )}
              {(recent ?? []).map((r) => {
                const form = r.form as unknown as { name?: string } | null;
                const contact = r.contact as unknown as { id: string; name: string } | null;
                return (
                  <div key={r.id} className="hair-t py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                        {contact ? (
                          <Link href={contactHref(contact.id)}>{contact.name}</Link>
                        ) : (
                          "Contacto borrado"
                        )}
                      </span>
                      <span className="text-[10.5px] text-ink-450">{relative(r.created_at)}</span>
                    </div>
                    <div className="mt-[2px] truncate text-[11px] text-ink-400">
                      {form?.name ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
