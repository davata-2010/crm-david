"use client";

import PageHeader from "@/components/PageHeader";
import TaskList from "@/components/TaskList";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData } from "@/components/SessionGate";
import { splitTasks } from "@/lib/metrics";
import type { Activity } from "@/lib/types";

export default function TasksPage() {
  return (
    <QueryBoundary>
      <Tasks />
    </QueryBoundary>
  );
}

function Tasks() {
  const q = useQuery();
  const { data } = useData(async (s) => {
    const [{ data: activities }, { data: contacts }, { data: deals }] = await Promise.all([
      s.supabase
        .from("activities")
        .select("*, contact:contacts(id,name), deal:deals(id,name)")
        .not("due_date", "is", null)
        .is("deleted_at", null)
        .order("due_date", { ascending: true }),
      s.supabase.from("contacts").select("id, name").is("deleted_at", null).order("name"),
      s.supabase
        .from("deals")
        .select("id, name")
        .lt("stage", 5)
        .is("deleted_at", null)
        .order("name"),
    ]);
    return {
      groups: splitTasks((activities ?? []) as Activity[]),
      contacts: contacts ?? [],
      deals: deals ?? [],
    };
  });

  if (!data) return <PageSkeleton />;
  const { groups } = data;

  return (
    <>
      <PageHeader
        crumb="Seguimiento"
        title="Tareas"
        subtitle={`${groups.pendingCount} pendientes · ${groups.overdue.length} vencidas`}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <TaskList
          groups={groups}
          contacts={data.contacts}
          deals={data.deals}
          openNew={q.get("new") === "1"}
        />
      </div>
    </>
  );
}
