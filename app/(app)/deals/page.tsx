"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EntityWorkspace from "@/components/grid/EntityWorkspace";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData, useSession } from "@/components/SessionGate";
import { queryEntity } from "@/lib/entity-query";
import { dealFields, parseViewConfig } from "@/lib/fields";
import type { CustomField, SavedView } from "@/lib/types";

export default function DealsPage() {
  return (
    <QueryBoundary>
      <Deals />
    </QueryBoundary>
  );
}

function Deals() {
  const q = useQuery();
  const params = Object.fromEntries(q.entries());
  const cfg = parseViewConfig({ kb: "stage", cb: "close_date", ...params });
  const key = q.toString();
  const s = useSession();

  const { data } = useData(async (s) => {
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
    return {
      rows,
      total,
      companies,
      fields: dealFields(
        companies,
        contactsRes.data ?? [],
        s.members,
        (fieldsRes.data ?? []) as CustomField[]
      ),
      views: (viewsRes.data ?? []) as SavedView[],
    };
  }, [key]);

  if (!data) return <PageSkeleton />;
  const { rows, total, companies, fields } = data;

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
          views={data.views}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
