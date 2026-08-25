"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(traduce(error.message));
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      setError(traduce(error.message));
      setBusy(false);
      return;
    }
    if (!data.session) {
      setNotice("Cuenta creada. Revisa tu email para confirmar la dirección.");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
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

        <div className="panel p-7">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">
            {mode === "login" ? "Entrar en tu workspace" : "Crear cuenta"}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-ink-350">
            {mode === "login"
              ? "Usa tu email y contraseña."
              : "Tu workspace se crea vacío y sólo tú ves tus datos."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            {mode === "signup" && (
              <Field label="Nombre">
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Marta Ruiz"
                  required
                />
              </Field>
            )}
            <Field label="Email ·">
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marta@aurum.agency"
                required
              />
            </Field>
            <Field label="Contraseña ·">
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </Field>

            {error && (
              <div className="rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-[10px] border border-hair bg-ink-800 px-3 py-2.5 text-[12.5px] text-ink-150">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-[10px] bg-gold px-5 py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
            >
              {busy ? "…" : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setNotice(null);
            }}
            className="mt-5 w-full text-center text-[12.5px] text-ink-350 transition-colors hover:text-gold"
          >
            {mode === "login"
              ? "¿No tienes cuenta? Regístrate"
              : "¿Ya tienes cuenta? Entrar"}
          </button>
        </div>
      </div>
    </div>
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

function traduce(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/already registered/i.test(msg)) return "Ese email ya tiene cuenta.";
  if (/at least 6/i.test(msg)) return "La contraseña necesita al menos 6 caracteres.";
  return msg;
}
