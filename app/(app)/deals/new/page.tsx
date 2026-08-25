import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import DealForm from "@/components/DealForm";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: { contact?: string; company?: string; stage?: string };
}) {
  const supabase = createClient();
  const [{ data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("contacts").select("id, name, company_id").order("name"),
  ]);

  const stage = Number(searchParams.stage);

  return (
    <>
      <PageHeader crumb="Pipeline" title="Nuevo deal" />
      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <DealForm
          companies={companies ?? []}
          contacts={contacts ?? []}
          defaultContactId={searchParams.contact}
          defaultCompanyId={searchParams.company}
          defaultStage={Number.isFinite(stage) && stage >= 0 && stage <= 6 ? stage : undefined}
        />
      </div>
    </>
  );
}
