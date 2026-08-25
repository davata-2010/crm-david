import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import CompaniesList, { type CompanyRow } from "@/components/CompaniesList";
import NewButton from "@/components/NewButton";
import type { Company, Contact, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const supabase = createClient();
  const [{ data: companiesData }, { data: contactsData }, { data: dealsData }] =
    await Promise.all([
      supabase.from("companies").select("*").is("deleted_at", null).order("name"),
      supabase.from("contacts").select("id, name, company_id").is("deleted_at", null),
      supabase.from("deals").select("id, company_id, value, stage").is("deleted_at", null),
    ]);

  const companies = (companiesData ?? []) as Company[];
  const contacts = (contactsData ?? []) as Contact[];
  const deals = (dealsData ?? []) as Deal[];

  const rows: CompanyRow[] = companies.map((c) => {
    const cContacts = contacts.filter((x) => x.company_id === c.id);
    const cDeals = deals.filter((d) => d.company_id === c.id);
    return {
      company: c,
      contacts: cContacts.map((x) => ({ id: x.id, name: x.name })),
      openValue: cDeals.filter((d) => d.stage < 5).reduce((a, d) => a + Number(d.value), 0),
      wonValue: cDeals.filter((d) => d.stage === 5).reduce((a, d) => a + Number(d.value), 0),
      openDeals: cDeals.filter((d) => d.stage < 5).length,
      totalDeals: cDeals.length,
    };
  });

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Empresas"
        subtitle={`${companies.length} cuentas · clic derecho para acciones`}
        action={<NewButton href="/companies/new" label="+ Empresa" />}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <CompaniesList rows={rows} />
      </div>
    </>
  );
}
