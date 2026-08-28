"use client";

import Sidebar from "@/components/Sidebar";
import Realtime from "@/components/Realtime";
import CommandPalette from "@/components/CommandPalette";
import { ChromeProvider } from "@/components/AppChrome";
import { SessionProvider, useSession } from "@/components/SessionGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChromeProvider>
      <SessionProvider>
        <Shell>{children}</Shell>
      </SessionProvider>
    </ChromeProvider>
  );
}

/** Ya dentro del proveedor: aquí la sesión existe seguro. */
function Shell({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const name = s.profile?.full_name || s.email.split("@")[0];

  return (
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
  );
}
