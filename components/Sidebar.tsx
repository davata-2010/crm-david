"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/format";
import { GOLD } from "@/lib/constants";
import { useChrome } from "@/components/AppChrome";

export type NavCounts = {
  contacts: number;
  companies: number;
  deals: number;
  tasks: number;
  activities: number;
};

const NAV: {
  href: string;
  label: string;
  icon: string;
  key: keyof NavCounts | null;
  alert?: boolean;
}[] = [
  { href: "/", label: "Dashboard", icon: "◫", key: null },
  { href: "/contacts", label: "Contactos", icon: "◍", key: "contacts" },
  { href: "/companies", label: "Empresas", icon: "▤", key: "companies" },
  { href: "/pipeline", label: "Pipeline", icon: "▦", key: "deals" },
  { href: "/tasks", label: "Tareas", icon: "✓", key: "tasks", alert: true },
  { href: "/activity", label: "Actividad", icon: "≡", key: "activities" },
  { href: "/reports", label: "Informes", icon: "◔", key: null },
  { href: "/settings", label: "Ajustes", icon: "⚙", key: null },
];

export default function Sidebar({
  counts,
  userName,
  userRole,
  overdue,
}: {
  counts: NavCounts;
  userName: string;
  userRole: string;
  overdue: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    const ok = await confirm({
      title: "Cerrar sesión",
      message: "Volverás a la pantalla de acceso.",
      confirmLabel: "Cerrar sesión",
    });
    if (!ok) return;
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-[248px] flex-[0_0_248px] flex-col border-r border-hair bg-ink-925 pb-5 pt-7">
      <div className="flex items-center gap-3 px-6 pb-7">
        <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-gold text-[15px] font-bold tracking-[-0.02em] text-ink-950">
          A
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Aurum</div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-350">
            AI Agency CRM
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 px-3.5">
        <div className="px-2.5 pb-2.5 text-[10px] uppercase tracking-[0.14em] text-ink-450">
          Workspace
        </div>
        {NAV.map((item) => {
          const active = isActive(item.href);
          const badge = item.key ? counts[item.key] : 0;
          const danger = item.alert && overdue > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onContextMenu={(e) =>
                openMenu(e, [
                  { kind: "label", label: item.label },
                  {
                    label: "Abrir",
                    icon: "↗",
                    onSelect: () => router.push(item.href),
                  },
                  {
                    label: "Copiar enlace",
                    icon: "⧉",
                    onSelect: () => {
                      navigator.clipboard.writeText(location.origin + item.href);
                      toast("Enlace copiado");
                    },
                  },
                ])
              }
              className="group flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors"
              style={{
                background: active ? "rgba(250,197,28,0.1)" : "transparent",
                color: active ? GOLD : "#9A9A9A",
              }}
            >
              <span
                className="w-[13px] text-center text-[11px]"
                style={{ color: active ? GOLD : "#4A4A4A" }}
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {danger ? (
                <span className="tnum rounded-full bg-[rgba(255,143,122,0.15)] px-[7px] py-[1px] text-[10.5px] font-semibold text-[#FF8F7A]">
                  {overdue}
                </span>
              ) : (
                <span className="tnum text-[11px] text-ink-400">{badge || ""}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-[18px]">
        <Link
          href="/deals/new"
          className="block w-full rounded-[9px] bg-gold px-3.5 py-[11px] text-center text-[13px] font-semibold tracking-[-0.01em] text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
        >
          + Nuevo deal
        </Link>
        <div className="mt-3 flex gap-2">
          <Link
            href="/contacts/new"
            className="flex-1 rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 py-2 text-center text-[12px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
          >
            + Contacto
          </Link>
          <Link
            href="/tasks?new=1"
            className="flex-1 rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 py-2 text-center text-[12px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
          >
            + Tarea
          </Link>
        </div>

        <div className="mt-[18px] flex items-center gap-[11px] border-t border-hair pt-[16px]">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(250,197,28,0.3)] bg-ink-800 text-[12px] font-semibold text-gold">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1 leading-[1.35]">
            <div className="truncate text-[13px] font-medium">{userName}</div>
            <div className="truncate text-[11px] text-ink-400">{userRole}</div>
          </div>
          <button
            onClick={signOut}
            title="Cerrar sesión"
            className="text-[13px] text-ink-500 transition-colors hover:text-gold"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
