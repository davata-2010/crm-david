"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Suscripción realtime a todas las tablas del CRM.
 * Cualquier INSERT/UPDATE/DELETE refresca los Server Components,
 * así el dashboard, la tabla y el kanban se mantienen en vivo.
 */
export default function Realtime({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };

    const channel = supabase.channel(`crm:${workspaceId}`);
    for (const table of ["contacts", "companies", "deals", "activities"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` },
        refresh
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, workspaceId]);

  return null;
}
