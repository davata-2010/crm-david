"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import AcceptInvite from "@/components/AcceptInvite";
import { inviteHref } from "@/lib/routes";

type Invitation = {
  email: string;
  role: string;
  accepted_at: string | null;
  workspace: { name?: string } | null;
};

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <Invite />
    </Suspense>
  );
}

function Invite() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ user: { email?: string } | null; inv: Invitation | null }>();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: auth }, { data: inv }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("invitations")
          .select("email, role, accepted_at, workspace:workspaces(name)")
          .eq("token", token)
          .maybeSingle(),
      ]);
      setState({ user: auth.user, inv: inv as unknown as Invitation | null });
    })();
  }, [token]);

  if (!state) return <div className="min-h-screen bg-ink-950" />;

  const { user, inv } = state;
  const workspaceName = inv?.workspace?.name ?? "un workspace";

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-gold text-[15px] font-bold text-ink-950">
            A
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.01em]">Aurum</div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-ink-350">
              AI Agency CRM
            </div>
          </div>
        </div>

        <div className="panel p-7">
          {!inv ? (
            <>
              <h1 className="text-[19px] font-semibold tracking-[-0.02em]">
                Invitación no válida
              </h1>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-350">
                El enlace no existe o ya se ha usado. Pide a quien te invitó que genere uno
                nuevo.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-[10px] border border-[rgba(245,245,245,0.12)] px-5 py-2.5 text-[13px] text-ink-150"
              >
                Ir al acceso
              </Link>
            </>
          ) : inv.accepted_at ? (
            <>
              <h1 className="text-[19px] font-semibold tracking-[-0.02em]">
                Invitación ya aceptada
              </h1>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-350">
                Esta invitación a <strong>{workspaceName}</strong> ya se usó.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950"
              >
                Entrar al CRM
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[19px] font-semibold tracking-[-0.02em]">
                Te han invitado a {workspaceName}
              </h1>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-350">
                La invitación es para <strong>{inv.email}</strong>, con rol de{" "}
                <strong>{inv.role}</strong>.
              </p>

              {user ? (
                <AcceptInvite token={token} sessionEmail={user.email!} invited={inv.email} />
              ) : (
                <>
                  <p className="mt-4 rounded-[10px] border border-hair bg-ink-800 px-3 py-2.5 text-[12.5px] text-ink-250">
                    Entra o regístrate con {inv.email} y esta invitación se aplicará
                    automáticamente.
                  </p>
                  <Link
                    href={`/login?next=${encodeURIComponent(inviteHref(token))}`}
                    className="mt-5 inline-block rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950"
                  >
                    Entrar o crear cuenta
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
