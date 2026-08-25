import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import PipelineBoard from "@/components/PipelineBoard";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, company:companies(id,name), contact:contacts(id,name)")
    .order("value", { ascending: false });

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Pipeline"
        action={
          <Link
            href="/deals/new"
            className="rounded-[9px] bg-gold px-4 py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
          >
            + Deal
          </Link>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <PipelineBoard deals={(data ?? []) as Deal[]} />
      </div>
    </>
  );
}
