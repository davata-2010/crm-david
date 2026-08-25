import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ActivityFeed from "@/components/ActivityFeed";
import type { Activity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("activities")
    .select("*, contact:contacts(id,name), deal:deals(id,name)")
    .order("occurred_at", { ascending: false })
    .limit(500);

  const activities = (data ?? []) as Activity[];

  return (
    <>
      <PageHeader
        crumb="Histórico"
        title="Actividad"
        subtitle={`${activities.length} registros · clic derecho para exportar o eliminar`}
      />
      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <ActivityFeed activities={activities} />
      </div>
    </>
  );
}
