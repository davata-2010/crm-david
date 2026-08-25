import Sidebar from "@/components/Sidebar";
import Realtime from "@/components/Realtime";
import CommandPalette from "@/components/CommandPalette";
import { ChromeProvider } from "@/components/AppChrome";
import { getSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const { supabase, workspace } = s;
  const nowIso = new Date().toISOString();

  const [contacts, companies, deals, activities, tasks, overdue, trash] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("companies").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .lt("stage", 5)
      .is("deleted_at", null),
    supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .not("due_date", "is", null)
      .eq("completed", false)
      .is("deleted_at", null),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .not("due_date", "is", null)
      .eq("completed", false)
      .is("deleted_at", null)
      .lt("due_date", nowIso),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);

  const name = s.profile?.full_name || s.email.split("@")[0];

  return (
    <ChromeProvider>
      <div className="flex min-h-screen bg-ink-950 text-[14px] text-ink-50">
        <Sidebar
          counts={{
            contacts: contacts.count ?? 0,
            companies: companies.count ?? 0,
            deals: deals.count ?? 0,
            tasks: tasks.count ?? 0,
            activities: activities.count ?? 0,
            trash: trash.count ?? 0,
          }}
          overdue={overdue.count ?? 0}
          userName={name}
          userRole={s.profile?.role || "Head of Growth"}
          role={s.role}
          workspace={workspace}
          workspaces={s.workspaces}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        <Realtime workspaceId={workspace.id} />
        <CommandPalette />
      </div>
    </ChromeProvider>
  );
}
