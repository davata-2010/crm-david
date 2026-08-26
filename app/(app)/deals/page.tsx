import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EntityWorkspace from "@/components/grid/EntityWorkspace";
import { getSession } from "@/lib/workspace";
import { queryEntity } from "@/lib/entity-query";
import { dealFields, parseViewConfig } from "@/lib/fields";
import type { CustomField, SavedView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const s = await getSession();
  const cfg = parseViewConfig({ kb: "stage", cb: "close_date", ...searchParams });

  const { rows, total } = await queryEntity(s.supabase, "deals", cfg, {
    field: "value",
    dir: "desc",
  });

  const [companiesRes, contactsRes, viewsRes, fieldsRes] = await Promise.all([
    s.supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
    s.supabase.from("contacts").select("id, name").is("deleted_at", null).order("name"),
    s.supabase.from("saved_views").select("*").eq("entity", "deals").order("created_at"),
    s.supabase
      .from("custom_fields")
      .select("*")
      .eq("entity", "deals")
      .order("position", { ascending: true }),
  ]);

  const companies = companiesRes.data ?? [];
  const fields = dealFields(
    companies,
    contactsRes.data ?? [],
    s.members,
    (fieldsRes.data ?? []) as CustomField[]
  );

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Deals"
        subtitle={`${total} deals · edita en la propia celda`}
        action={
          <Link
            href="/pipeline"
            className="rounded-[9px] border border-[rgba(245,245,245,0.12)] px-3.5 py-[9px] text-[12.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
          >
            Ver pipeline
          </Link>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityWorkspace
          entity="deals"
          rows={rows}
          total={total}
          config={cfg}
          fields={fields}
          companies={companies}
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
