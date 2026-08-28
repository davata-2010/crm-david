"use client";

import PageHeader from "@/components/PageHeader";
import EntityWorkspace from "@/components/grid/EntityWorkspace";
import NewButton from "@/components/NewButton";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData, useSession } from "@/components/SessionGate";
import { queryEntity } from "@/lib/entity-query";
import { companyFields, parseViewConfig } from "@/lib/fields";
import type { SavedView } from "@/lib/types";

export default function CompaniesPage() {
  return (
    <QueryBoundary>
      <Companies />
    </QueryBoundary>
  );
}

function Companies() {
  const q = useQuery();
  const cfg = parseViewConfig(Object.fromEntries(q.entries()));
  const key = q.toString();
  const s = useSession();

  const { data } = useData(async (s) => {
    const { rows, total } = await queryEntity(s.supabase, "companies", cfg, {
      field: "open_value",
      dir: "desc",
    });

    const viewsRes = await s.supabase
      .from("saved_views")
      .select("*")
      .eq("entity", "companies")
      .order("created_at");

    return { rows, total, views: (viewsRes.data ?? []) as SavedView[] };
  }, [key]);

  if (!data) return <PageSkeleton />;
  const { rows, total } = data;

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Empresas"
        subtitle={`${total} cuentas · edita en la propia celda`}
        action={s.canWrite ? <NewButton href="/companies/new" label="+ Empresa" /> : null}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityWorkspace
          entity="companies"
          rows={rows}
          total={total}
          config={cfg}
          fields={companyFields()}
          companies={[]}
          members={s.members}
          tags={[]}
          views={data.views}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
