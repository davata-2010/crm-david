import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import PipelineBoard from "@/components/PipelineBoard";
import NewButton from "@/components/NewButton";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, company:companies(id,name), contact:contacts(id,name)")
    .is("deleted_at", null)
    .order("value", { ascending: false });

  const deals = (data ?? []) as Deal[];
  const open = deals.filter((d) => d.stage < 5).length;

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Pipeline"
        subtitle={`${open} deals abiertos de ${deals.length} · arrastra o usa el clic derecho`}
        action={<NewButton href="/deals/new" label="+ Deal" />}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <PipelineBoard deals={deals} />
      </div>
    </>
  );
}
