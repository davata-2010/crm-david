"use client";

import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import TrashView, { type TrashRow } from "@/components/TrashView";
import { useData, useSession } from "@/components/SessionGate";
import { STAGES } from "@/lib/constants";
import { eur } from "@/lib/format";

export default function TrashPage() {
  const { isAdmin, canWrite } = useSession();

  const { data: rows } = useData(async ({ supabase }) => {
    const [contacts, companies, deals, activities] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, email, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("companies")
        .select("id, name, industry, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("deals")
        .select("id, name, value, stage, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("activities")
        .select("id, title, kind, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

    const list: TrashRow[] = [
      ...(contacts.data ?? []).map((r) => ({
        id: r.id,
        entity: "contacts" as const,
        label: r.name,
        sub: r.email || "Sin email",
        deleted_at: r.deleted_at,
      })),
      ...(companies.data ?? []).map((r) => ({
        id: r.id,
        entity: "companies" as const,
        label: r.name,
        sub: r.industry || "Sin sector",
        deleted_at: r.deleted_at,
      })),
      ...(deals.data ?? []).map((r) => ({
        id: r.id,
        entity: "deals" as const,
        label: r.name,
        sub: `${eur(Number(r.value))} · ${STAGES[r.stage]}`,
        deleted_at: r.deleted_at,
      })),
      ...(activities.data ?? []).map((r) => ({
        id: r.id,
        entity: "activities" as const,
        label: r.title,
        sub: r.kind,
        deleted_at: r.deleted_at,
      })),
    ].sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at));

    return list;
  });

  if (!rows) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        crumb="Workspace"
        title="Papelera"
        subtitle={`${rows.length} elementos recuperables`}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <TrashView rows={rows} isAdmin={isAdmin} canWrite={canWrite} />
      </div>
    </>
  );
}
