import PageHeader from "@/components/PageHeader";
import EntityWorkspace from "@/components/grid/EntityWorkspace";
import NewButton from "@/components/NewButton";
import { getSession } from "@/lib/workspace";
import { queryEntity } from "@/lib/entity-query";
import { companyFields, parseViewConfig } from "@/lib/fields";
import type { SavedView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const s = await getSession();
  const cfg = parseViewConfig(searchParams);

  const { rows, total } = await queryEntity(s.supabase, "companies", cfg, {
    field: "open_value",
    dir: "desc",
  });

  const viewsRes = await s.supabase
    .from("saved_views")
    .select("*")
    .eq("entity", "companies")
    .order("created_at");

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
          views={(viewsRes.data ?? []) as SavedView[]}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
