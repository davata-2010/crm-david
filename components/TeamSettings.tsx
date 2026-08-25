"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  renameWorkspace,
  revokeInvitation,
} from "@/app/actions";
import { GOLD } from "@/lib/constants";
import { initials, relative } from "@/lib/format";
import type { Invitation, MemberRole, Membership, Workspace } from "@/lib/types";

const ROLES: { key: MemberRole; label: string; desc: string }[] = [
  { key: "owner", label: "Propietario", desc: "Control total, incluida la facturación" },
  { key: "admin", label: "Administrador", desc: "Gestiona equipo, campos y ajustes" },
  { key: "member", label: "Miembro", desc: "Crea y edita contactos, deals y tareas" },
  { key: "viewer", label: "Sólo lectura", desc: "Ve todo pero no puede modificar nada" },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label])) as Record<
  MemberRole,
  string
>;

export default function TeamSettings({
  workspace,
  members,
  invitations,
  isAdmin,
  currentUserId,
}: {
  workspace: Workspace;
  members: Membership[];
  invitations: Invitation[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [name, setName] = useState(workspace.name);

  function run(fn: () => Promise<{ error?: string; id?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        router.refresh();
      }
    });
  }

  function memberMenu(m: Membership): MenuItem[] {
    const isSelf = m.user_id === currentUserId;
    if (!isAdmin) return [{ kind: "label", label: m.profile?.full_name || "Miembro" }];
    return [
      { kind: "label", label: m.profile?.full_name || m.profile?.email || "Miembro" },
      {
        label: "Copiar email",
        icon: "⧉",
        disabled: !m.profile?.email,
        onSelect: () => {
          navigator.clipboard.writeText(m.profile!.email);
          toast("Email copiado.");
        },
      },
      { kind: "separator" },
      { kind: "label", label: "Cambiar rol" },
      ...ROLES.map((r) => ({
        label: r.label,
        icon: m.role === r.key ? "●" : "○",
        disabled: isSelf || m.role === r.key,
        onSelect: () => run(() => changeMemberRole(m.user_id, r.key), "Rol actualizado."),
      })),
      { kind: "separator" },
      {
        label: "Quitar del workspace",
        icon: "✕",
        danger: true,
        disabled: isSelf,
        onSelect: async () => {
          const ok = await confirm({
            title: "Quitar del workspace",
            message: `${m.profile?.full_name || m.profile?.email} dejará de ver estos datos. Sus registros se conservan.`,
            confirmLabel: "Quitar",
            danger: true,
          });
          if (ok) run(() => removeMember(m.user_id), "Miembro retirado.");
        },
      },
    ];
  }

  const pending = invitations.filter((i) => !i.accepted_at);

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Workspace</div>
        <div className="mt-1 text-[12.5px] text-ink-350">
          Todos los miembros comparten contactos, empresas, deals y actividades.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            className="field max-w-[320px] disabled:opacity-60"
          />
          {isAdmin && (
            <button
              onClick={() => run(() => renameWorkspace(name), "Nombre actualizado.")}
              className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
            >
              Guardar nombre
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="panel p-[26px]">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Invitar al equipo</div>
          <div className="mt-1 text-[12.5px] text-ink-350">
            Se genera un enlace de invitación. Cópialo y mándaselo por el canal que prefieras —
            el CRM todavía no envía emails.
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="companero@aurum.agency"
              className="field max-w-[280px]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="field max-w-[190px]"
            >
              {ROLES.filter((r) => r.key !== "owner").map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                start(async () => {
                  const res = await inviteMember(email, role);
                  if (res?.error) toast(res.error, "error");
                  else {
                    const link = `${location.origin}/invite/${res.id}`;
                    await navigator.clipboard.writeText(link).catch(() => {});
                    toast("Invitación creada y enlace copiado.");
                    setEmail("");
                    router.refresh();
                  }
                })
              }
              className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
            >
              Crear invitación
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r.key} className="rounded-[10px] border border-hair bg-ink-800 px-3.5 py-2.5">
                <div className="text-[12.5px] font-medium">{r.label}</div>
                <div className="mt-[2px] text-[11px] text-ink-400">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="panel p-[26px]">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Invitaciones pendientes
          </div>
          <div className="mt-2">
            {pending.map((i) => (
              <div key={i.id} className="hair-t flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{i.email}</div>
                  <div className="text-[11.5px] text-ink-400">
                    {ROLE_LABEL[i.role]} · creada {relative(i.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${location.origin}/invite/${i.token}`);
                    toast("Enlace copiado.");
                  }}
                  className="rounded-[8px] border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
                >
                  Copiar enlace
                </button>
                {isAdmin && (
                  <button
                    onClick={() => run(() => revokeInvitation(i.id), "Invitación revocada.")}
                    className="text-[11.5px] text-ink-350 transition-colors hover:text-[#FF8F7A]"
                  >
                    Revocar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel p-[26px]">
        <div className="flex items-baseline gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">Miembros</div>
            <div className="mt-1 text-[12.5px] text-ink-350">
              {members.length} {members.length === 1 ? "persona" : "personas"} con acceso ·
              clic derecho para cambiar rol
            </div>
          </div>
        </div>
        <div className="mt-3">
          {members.map((m) => (
            <div
              key={m.id}
              onContextMenu={(e) => openMenu(e, memberMenu(m))}
              className="hair-t flex flex-wrap items-center gap-3.5 py-3.5"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(245,245,245,0.08)] bg-ink-800 text-[11.5px] font-semibold text-ink-150">
                {initials(m.profile?.full_name || m.profile?.email || "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">
                  {m.profile?.full_name || m.profile?.email || "Miembro"}
                  {m.user_id === currentUserId && (
                    <span className="ml-2 text-[11px] text-ink-450">tú</span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-ink-400">{m.profile?.email}</div>
              </div>
              <span
                className="rounded-full px-[11px] py-1 text-[11px] font-semibold"
                style={{
                  background: m.role === "owner" ? GOLD : "rgba(245,245,245,0.06)",
                  color: m.role === "owner" ? "#080808" : "#C8C8C8",
                  border: `1px solid ${m.role === "owner" ? GOLD : "rgba(245,245,245,0.14)"}`,
                }}
              >
                {ROLE_LABEL[m.role]}
              </span>
              <span className="w-[110px] text-right text-[12px] text-ink-350">
                {relative(m.created_at)}
              </span>
              <button
                onClick={(e) => openMenu(e, memberMenu(m))}
                className="text-[15px] text-ink-500 transition-colors hover:text-gold"
              >
                ⋯
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
