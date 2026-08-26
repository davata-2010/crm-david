import Sidebar from "@/components/Sidebar";
import Realtime from "@/components/Realtime";
import CommandPalette from "@/components/CommandPalette";
import { ChromeProvider } from "@/components/AppChrome";
import { getSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Una sola llamada: sesión, workspace, equipo y contadores.
  const s = await getSession();
  const name = s.profile?.full_name || s.email.split("@")[0];

  return (
    <ChromeProvider>
      <div className="flex min-h-screen bg-ink-950 text-[14px] text-ink-50">
        <Sidebar
          counts={s.counts}
          overdue={s.counts.overdue}
          userName={name}
          userRole={s.profile?.role || "Head of Growth"}
          role={s.role}
          workspace={s.workspace}
          workspaces={s.workspaces}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        <Realtime workspaceId={s.workspace.id} />
        <CommandPalette />
      </div>
    </ChromeProvider>
  );
}
