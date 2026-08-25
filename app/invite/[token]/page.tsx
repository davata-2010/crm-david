import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AcceptInvite from "@/components/AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inv } = await supabase
    .from("invitations")
    .select("email, role, accepted_at, workspace:workspaces(name)")
    .eq("token", params.token)
    .maybeSingle();

  const workspaceName =
    (inv?.workspace as unknown as { name?: string } | null)?.name ?? "un workspace";

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
                <AcceptInvite token={params.token} sessionEmail={user.email!} invited={inv.email} />
              ) : (
                <>
                  <p className="mt-4 rounded-[10px] border border-hair bg-ink-800 px-3 py-2.5 text-[12.5px] text-ink-250">
                    Entra o regístrate con {inv.email} y esta invitación se aplicará
                    automáticamente.
                  </p>
                  <Link
                    href={`/login?next=/invite/${params.token}`}
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
