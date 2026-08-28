"use client";

import PageHeader from "@/components/PageHeader";
import EntityWorkspace from "@/components/grid/EntityWorkspace";
import NewButton from "@/components/NewButton";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData, useSession } from "@/components/SessionGate";
import { queryEntity } from "@/lib/entity-query";
import { contactFields, parseViewConfig } from "@/lib/fields";
import type { CustomField, SavedView } from "@/lib/types";

export default function ContactsPage() {
  return (
    <QueryBoundary>
      <Contacts />
    </QueryBoundary>
  );
}

function Contacts() {
  const q = useQuery();
  const params = Object.fromEntries(q.entries());
  const cfg = parseViewConfig(params);
  const key = q.toString();
  const s = useSession();

  const { data } = useData(async (s) => {
    const { rows, total } = await queryEntity(s.supabase, "contacts", cfg, {
      field: "last_activity",
      dir: "desc",
    });

    const [{ data: facets }, companiesRes, viewsRes, fieldsRes] = await Promise.all([
      s.supabase.rpc("contact_facets"),
      s.supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
      s.supabase.from("saved_views").select("*").eq("entity", "contacts").order("created_at"),
      s.supabase
        .from("custom_fields")
        .select("*")
        .eq("entity", "contacts")
        .order("position", { ascending: true }),
    ]);

    const companies = companiesRes.data ?? [];
    return {
      rows,
      total,
      companies,
      fields: contactFields(companies, s.members, (fieldsRes.data ?? []) as CustomField[]),
      tags: ((facets?.tags ?? []) as string[]).filter(Boolean),
      views: (viewsRes.data ?? []) as SavedView[],
    };
  }, [key]);

  if (!data) return <PageSkeleton />;
  const { rows, total, companies, fields } = data;

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Contactos"
        subtitle={`${total} registros · edita en la propia celda`}
        action={s.canWrite ? <NewButton href="/contacts/new" label="+ Contacto" /> : null}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EntityWorkspace
          entity="contacts"
          rows={rows}
          total={total}
          config={cfg}
          fields={fields}
          companies={companies}
          members={s.members}
          tags={data.tags}
          views={data.views}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
