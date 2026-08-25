import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import Realtime from "@/components/Realtime";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, contacts, companies, deals, activities] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("deals").select("id", { count: "exact", head: true }).lt("stage", 5),
    supabase.from("activities").select("id", { count: "exact", head: true }),
  ]);

  const p = profile as Profile | null;
  const name =
    p?.full_name || (user.user_metadata?.full_name as string) || user.email!.split("@")[0];

  return (
    <div className="flex min-h-screen bg-ink-950 text-[14px] text-ink-50">
      <Sidebar
        counts={{
          contacts: contacts.count ?? 0,
          companies: companies.count ?? 0,
          deals: deals.count ?? 0,
          activities: activities.count ?? 0,
        }}
        userName={name}
        userRole={p?.role || "Head of Growth"}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <Realtime userId={user.id} />
    </div>
  );
}
