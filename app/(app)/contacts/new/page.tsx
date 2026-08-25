import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const supabase = createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <>
      <PageHeader crumb="Contactos" title="Nuevo contacto" />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="panel max-w-[720px] p-7">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Datos del contacto
          </div>
          <div className="mb-6 mt-1 text-[12.5px] text-ink-350">
            Los campos marcados con · son obligatorios.
          </div>
          <ContactForm companies={companies ?? []} defaultCompanyId={searchParams.company} />
        </div>
      </div>
    </>
  );
}
