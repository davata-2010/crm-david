"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/actions";

export default function AcceptInvite({
  token,
  sessionEmail,
  invited,
}: {
  token: string;
  sessionEmail: string;
  invited: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mismatch = sessionEmail.toLowerCase() !== invited.toLowerCase();

  return (
    <div className="mt-5">
      {mismatch && (
        <div className="mb-4 rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
          Tu sesión es {sessionEmail}, pero la invitación es para {invited}. Cierra sesión y
          entra con esa cuenta.
        </div>
      )}
      {error && <div className="mb-3 text-[12.5px] text-gold">{error}</div>}
      <button
        disabled={pending || mismatch}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await acceptInvitation(token);
            if (res?.error) setError(res.error);
            else {
              router.replace("/");
              router.refresh();
            }
          })
        }
        className="w-full rounded-[10px] bg-gold px-5 py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-40"
      >
        {pending ? "Uniéndote…" : "Aceptar invitación"}
      </button>
    </div>
  );
}
