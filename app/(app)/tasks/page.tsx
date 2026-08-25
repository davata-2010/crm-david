import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import { splitTasks } from "@/lib/metrics";
import type { Activity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { new?: string };
}) {
  const supabase = createClient();

  const [{ data: activities }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase
      .from("activities")
      .select("*, contact:contacts(id,name), deal:deals(id,name)")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true }),
    supabase.from("contacts").select("id, name").order("name"),
    supabase.from("deals").select("id, name").lt("stage", 5).order("name"),
  ]);

  const groups = splitTasks((activities ?? []) as Activity[]);

  return (
    <>
      <PageHeader
        crumb="Seguimiento"
        title="Tareas"
        subtitle={`${groups.pendingCount} pendientes · ${groups.overdue.length} vencidas`}
      />
      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <TaskList
          groups={groups}
          contacts={contacts ?? []}
          deals={deals ?? []}
          openNew={searchParams.new === "1"}
        />
      </div>
    </>
  );
}
