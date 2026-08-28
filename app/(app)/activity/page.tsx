"use client";

import PageHeader from "@/components/PageHeader";
import ActivityFeed from "@/components/ActivityFeed";
import PageSkeleton from "@/components/PageSkeleton";
import { useData } from "@/components/SessionGate";
import type { Activity } from "@/lib/types";

export default function ActivityPage() {
  const { data } = useData(async (s) => {
    const { data } = await s.supabase
      .from("activities")
      .select("*, contact:contacts(id,name), deal:deals(id,name)")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(500);
    return (data ?? []) as Activity[];
  });

  if (!data) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        crumb="Histórico"
        title="Actividad"
        subtitle={`${data.length} registros · clic derecho para exportar o eliminar`}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <ActivityFeed activities={data} />
      </div>
    </>
  );
}
