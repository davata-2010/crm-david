"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions";
import { GOLD } from "@/lib/constants";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types";

const PREFS: [keyof Profile["prefs"], string, string][] = [
  ["digest", "Resumen diario", "Un email a las 8:00 con deals que necesitan atención."],
  ["mentions", "Menciones del equipo", "Notificar cuando alguien te menciona en una nota."],
  ["autoLog", "Registro automático de emails", "Adjuntar la conversación de Gmail al contacto."],
  ["weighted", "Forecast ponderado", "Mostrar valores multiplicados por probabilidad de etapa."],
];

const DEFAULTS = { digest: true, mentions: true, autoLog: false, weighted: true };

export default function ProfileForm({
  profile,
  email,
}: {
  profile: Profile | null;
  email: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({ ...DEFAULTS, ...(profile?.prefs ?? {}) });
  const [name, setName] = useState(profile?.full_name || email.split("@")[0]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        Object.entries(prefs).forEach(([k, v]) => {
          if (v) fd.set(k, "on");
          else fd.delete(k);
        });
        start(async () => {
          setError(null);
          const res = await updateProfile(fd);
          if (res?.error) setError(res.error);
          else {
            setSaved(true);
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Perfil</div>
        <div className="mt-5 flex items-center gap-[18px]">
          <div className="grid h-[62px] w-[62px] place-items-center rounded-full border border-[rgba(250,197,28,0.35)] bg-ink-800 text-[19px] font-semibold text-gold">
            {initials(name)}
          </div>
          <div className="text-[11.5px] leading-[1.6] text-ink-400">
            El avatar se genera con tus iniciales.
            <br />
            Cambia tu nombre para actualizarlo.
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Nombre">
            <input
              name="full_name"
              className="field"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Cargo">
            <input
              name="role"
              className="field"
              defaultValue={profile?.role || "Head of Growth"}
              onChange={() => setSaved(false)}
            />
          </Field>
          <Field label="Email">
            <input name="email" className="field" defaultValue={profile?.email || email} readOnly />
          </Field>
          <Field label="Teléfono">
            <input
              name="phone"
              className="field"
              defaultValue={profile?.phone ?? ""}
              placeholder="+34 655 41 20 08"
              onChange={() => setSaved(false)}
            />
          </Field>
        </div>
      </div>

      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Preferencias</div>
        <div className="mt-1.5">
          {PREFS.map(([key, label, desc]) => {
            const on = prefs[key];
            return (
              <div key={key} className="hair-t flex items-center gap-[18px] py-4">
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">{label}</div>
                  <div className="mt-[3px] text-[12px] text-ink-350">{desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrefs((p) => ({ ...p, [key]: !p[key] }));
                    setSaved(false);
                  }}
                  className="flex h-[26px] w-[46px] items-center rounded-full p-0"
                  style={{
                    background: on ? GOLD : "#1A1A1A",
                    border: `1px solid ${on ? GOLD : "rgba(245,245,245,0.12)"}`,
                    justifyContent: on ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    className="mx-[3px] h-[18px] w-[18px] rounded-full"
                    style={{ background: on ? "#080808" : "#5A5A5A" }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="text-[12.5px] text-gold">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-gold px-[22px] py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-5 py-3 text-[13.5px] text-ink-150 transition-colors hover:text-ink-50"
        >
          Descartar
        </button>
        {saved && <span className="text-[12px] text-ink-400">Guardado.</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">{label}</div>
      {children}
    </div>
  );
}
