"use client";

import PageHeader from "@/components/PageHeader";
import DealForm from "@/components/DealForm";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData } from "@/components/SessionGate";

export default function NewDealPage() {
  return (
    <QueryBoundary>
      <NewDeal />
    </QueryBoundary>
  );
}

function NewDeal() {
  const q = useQuery();
  const { data } = useData(async (s) => {
    const [{ data: companies }, { data: contacts }] = await Promise.all([
      s.supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
      s.supabase
        .from("contacts")
        .select("id, name, company_id")
        .is("deleted_at", null)
        .order("name"),
    ]);
    return { companies: companies ?? [], contacts: contacts ?? [] };
  });

  if (!data) return <PageSkeleton />;

  const stage = Number(q.get("stage"));

  return (
    <>
      <PageHeader crumb="Pipeline" title="Nuevo deal" />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <DealForm
          companies={data.companies}
          contacts={data.contacts}
          defaultContactId={q.get("contact") ?? undefined}
          defaultCompanyId={q.get("company") ?? undefined}
          defaultStage={Number.isFinite(stage) && stage >= 0 && stage <= 6 ? stage : undefined}
        />
      </div>
    </>
  );
}
