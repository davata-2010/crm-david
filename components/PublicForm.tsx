"use client";

import { useState } from "react";
import type { FormField } from "./FormBuilder";

/** Formulario público: no depende de la sesión ni del resto de la app. */
export default function PublicForm({
  slug,
  title,
  description,
  fields,
  submitLabel,
  embed,
}: {
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  submitLabel: string;
  embed: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar.");
        setState("idle");
        return;
      }
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setMessage(data.message ?? "¡Gracias!");
      setState("done");
    } catch {
      setError("No hay conexión con el servidor.");
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold text-[20px] text-ink-950">
          ✓
        </div>
        <h1 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">¡Recibido!</h1>
        <p className="mx-auto mt-2 max-w-[380px] text-[13px] leading-[1.6] text-ink-350">
          {message}
        </p>
      </div>
    );

  return (
    <form onSubmit={submit}>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
      {description && (
        <p className="mt-2 text-[13px] leading-[1.6] text-ink-350">{description}</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.1em] text-ink-300">
              {f.label} {f.required && <span className="text-gold">·</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                required={f.required}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="min-h-[110px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-3.5 py-3 text-[13.5px] leading-[1.55] text-ink-50 outline-none focus:border-gold"
              />
            ) : (
              <input
                type={f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"}
                required={f.required}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="field"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-6 w-full rounded-[10px] bg-gold px-5 py-3.5 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
      >
        {state === "sending" ? "Enviando…" : submitLabel}
      </button>

      {!embed && (
        <p className="mt-5 text-center text-[10.5px] text-ink-500">
          Tus datos se guardan sólo para responderte.
        </p>
      )}
    </form>
  );
}
