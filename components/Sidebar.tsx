"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { switchWorkspace } from "@/app/actions";
import { initials } from "@/lib/format";
import { GOLD } from "@/lib/constants";
import { useChrome } from "@/components/AppChrome";
import type { MemberRole, Workspace } from "@/lib/types";

export type NavCounts = {
  contacts: number;
  companies: number;
  deals: number;
  tasks: number;
  activities: number;
  trash: number;
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
  { href: "/trash", label: "Papelera", icon: "⌫", key: "trash" },
  { href: "/settings", label: "Ajustes", icon: "⚙", key: null },
];

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  viewer: "Sólo lectura",
};

export default function Sidebar({
  counts,
  userName,
  userRole,
  overdue,
  role,
  workspace,
  workspaces,
}: {
  counts: NavCounts;
  userName: string;
  userRole: string;
  overdue: number;
  role: MemberRole;
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

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

  function workspaceMenu(e: React.MouseEvent) {
    openMenu(e, [
      { kind: "label", label: "Cambiar de workspace" },
      ...workspaces.map((w) => ({
        label: w.name,
        icon: w.id === workspace.id ? "●" : "○",
        disabled: w.id === workspace.id,
        onSelect: () =>
          start(async () => {
            await switchWorkspace(w.id);
            router.refresh();
          }),
      })),
      { kind: "separator" },
      {
        label: "Equipo y roles",
        icon: "◍",
        onSelect: () => router.push("/settings?tab=team"),
      },
      {
        label: "Copiar clave de API",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(workspace.api_key);
          toast("Clave copiada.");
        },
      },
    ]);
  }

  return (
    <>
      {/* Barra superior sólo en móvil */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-[10px] border border-hair bg-ink-900 text-[16px] text-ink-150 lg:hidden"
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(4,4,4,0.6)] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-[0_0_248px] flex-col border-r border-hair bg-ink-925 pb-5 pt-7 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onContextMenu={workspaceMenu}
          onClick={workspaceMenu}
          className="mx-3.5 flex items-center gap-3 rounded-[10px] px-2.5 pb-3 pt-1 text-left transition-colors hover:bg-ink-900"
        >
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-gold text-[15px] font-bold tracking-[-0.02em] text-ink-950">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
              {workspace.name}
            </div>
            <div className="truncate text-[10.5px] uppercase tracking-[0.08em] text-ink-350">
              Aurum · {ROLE_LABEL[role]}
            </div>
          </div>
          <span className="text-[10px] text-ink-500">▾</span>
        </button>

        <div className="mt-2 flex flex-col gap-0.5 overflow-y-auto px-3.5">
          <div className="px-2.5 pb-2 text-[10px] uppercase tracking-[0.14em] text-ink-450">
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
                onClick={() => setOpen(false)}
                onContextMenu={(e) =>
                  openMenu(e, [
                    { kind: "label", label: item.label },
                    { label: "Abrir", icon: "↗", onSelect: () => router.push(item.href) },
                    {
                      label: "Abrir en pestaña nueva",
                      icon: "⧉",
                      onSelect: () => window.open(item.href, "_blank"),
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
                className="flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors"
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

        <div className="mt-auto px-[18px] pt-4">
          {role !== "viewer" && (
            <>
              <Link
                href="/deals/new"
                onClick={() => setOpen(false)}
                className="block w-full rounded-[9px] bg-gold px-3.5 py-[11px] text-center text-[13px] font-semibold tracking-[-0.01em] text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
              >
                + Nuevo deal
              </Link>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/contacts/new"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 py-2 text-center text-[12px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
                >
                  + Contacto
                </Link>
                <Link
                  href="/tasks?new=1"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 py-2 text-center text-[12px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
                >
                  + Tarea
                </Link>
              </div>
            </>
          )}

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
    </>
  );
}
