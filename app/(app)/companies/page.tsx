import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import CompanyForm from "@/components/CompanyForm";
import { eur, initials } from "@/lib/format";
import type { Company, Contact, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { edit?: string; q?: string };
}) {
  const supabase = createClient();
  const [{ data: companiesData }, { data: contactsData }, { data: dealsData }] =
    await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("contacts").select("id, name, company_id"),
      supabase.from("deals").select("id, company_id, value, stage"),
    ]);

  const companies = (companiesData ?? []) as Company[];
  const contacts = (contactsData ?? []) as Contact[];
  const deals = (dealsData ?? []) as Deal[];
  const q = (searchParams.q || "").trim().toLowerCase();
  const editing = companies.find((c) => c.id === searchParams.edit);

  const visible = q
    ? companies.filter((c) =>
        `${c.name}${c.industry ?? ""}`.toLowerCase().includes(q)
      )
    : companies;

  return (
    <>
      <PageHeader crumb="CRM" title="Empresas" />

      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4">
          <div className="flex flex-col gap-3">
            {visible.length === 0 && (
              <div className="panel px-6 py-10 text-center text-[12.5px] text-ink-400">
                Todavía no hay empresas. Añade la primera desde el panel de la derecha.
              </div>
            )}
            {visible.map((c) => {
              const cContacts = contacts.filter((x) => x.company_id === c.id);
              const cDeals = deals.filter((d) => d.company_id === c.id);
              const open = cDeals.filter((d) => d.stage < 5);
              const total = open.reduce((a, d) => a + Number(d.value), 0);
              return (
                <div key={c.id} className="panel px-5 py-[18px]">
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-[38px] w-[38px] flex-[0_0_38px] place-items-center rounded-[10px] bg-ink-800 text-[12px] font-semibold text-gold">
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                        {c.name}
                      </div>
                      <div className="mt-[3px] truncate text-[11.5px] text-ink-350">
                        {c.industry || "Sin sector"}
                        {c.website ? ` · ${c.website}` : ""}
                      </div>
                    </div>
                    <div className="tnum text-right">
                      <div className="text-[13.5px] font-semibold text-gold">
                        {eur(total)}
                      </div>
                      <div className="mt-[2px] text-[11px] text-ink-400">
                        {open.length} deals · {cContacts.length} contactos
                      </div>
                    </div>
                    <Link
                      href={`/companies?edit=${c.id}`}
                      className="ml-2 rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3.5 py-2 text-[12px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
                    >
                      Editar
                    </Link>
                  </div>
                  {cContacts.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[rgba(245,245,245,0.06)] pt-3">
                      {cContacts.map((p) => (
                        <Link
                          key={p.id}
                          href={`/contacts/${p.id}`}
                          className="rounded-md border border-hair bg-ink-800 px-2 py-[3px] text-[10.5px] text-ink-350 transition-colors hover:text-gold"
                        >
                          {p.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="panel p-6">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              {editing ? "Editar empresa" : "Nueva empresa"}
            </div>
            <div className="mb-5 mt-1 text-[12.5px] text-ink-350">
              {editing
                ? "Los contactos y deals vinculados se mantienen."
                : "Las cuentas alimentan el selector de deals."}
            </div>
            <CompanyForm key={editing?.id ?? "new"} company={editing} />
          </div>
        </div>
      </div>
    </>
  );
}
