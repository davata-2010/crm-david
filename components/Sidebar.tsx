"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/format";
import { GOLD } from "@/lib/constants";

export type NavCounts = {
  contacts: number;
  companies: number;
  deals: number;
  activities: number;
};

const NAV: { href: string; label: string; key: keyof NavCounts | null }[] = [
  { href: "/", label: "Dashboard", key: "activities" },
  { href: "/contacts", label: "Contactos", key: "contacts" },
  { href: "/companies", label: "Empresas", key: "companies" },
  { href: "/pipeline", label: "Pipeline", key: "deals" },
  { href: "/settings", label: "Ajustes", key: null },
];

export default function Sidebar({
  counts,
  userName,
  userRole,
}: {
  counts: NavCounts;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-[248px] flex-[0_0_248px] flex-col border-r border-hair bg-ink-925 pb-5 pt-7">
      <div className="flex items-center gap-3 px-6 pb-8">
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors"
              style={{
                background: active ? "rgba(250,197,28,0.1)" : "transparent",
                color: active ? GOLD : "#9A9A9A",
              }}
            >
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: active ? GOLD : "#3A3A3A" }}
              />
              <span className="flex-1">{item.label}</span>
              <span className="tnum text-[11px] text-ink-400">
                {item.key ? counts[item.key] : ""}
              </span>
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
        <div className="mt-[22px] flex items-center gap-[11px] border-t border-hair pt-[18px]">
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
