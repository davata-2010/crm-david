"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { saveForm, deleteForm } from "@/app/automations";
import { GOLD } from "@/lib/constants";

export type FormField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

export type FormRow = {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  submit_label: string;
  success_message: string;
  redirect_url: string;
  tags: string[];
  active: boolean;
  submissions: number;
};

const BUILTIN: { key: string; label: string; type: FormField["type"] }[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Teléfono", type: "tel" },
  { key: "company", label: "Empresa", type: "text" },
  { key: "message", label: "Mensaje", type: "textarea" },
];

export default function FormBuilder({ form, origin }: { form: FormRow; origin: string }) {
  const router = useRouter();
  const { confirm, toast } = useChrome();
  const [, start] = useTransition();

  const [state, setState] = useState<FormRow>(form);
  const set = <K extends keyof FormRow>(k: K, v: FormRow[K]) =>
    setState((p) => ({ ...p, [k]: v }));

  const publicUrl = `${origin}/f/${state.slug}`;
  const embed = `<iframe src="${publicUrl}?embed=1" width="100%" height="620" style="border:0;border-radius:14px" title="${state.name}"></iframe>`;

  const addField = (key: string) => {
    if (state.fields.some((f) => f.key === key)) return;
    const b = BUILTIN.find((x) => x.key === key);
    set("fields", [
      ...state.fields,
      b
        ? { key: b.key, label: b.label, type: b.type, required: b.key === "name" }
        : { key, label: key, type: "text", required: false },
    ]);
  };

  const setField = (i: number, patch: Partial<FormField>) =>
    set(
      "fields",
      state.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f))
    );

  const move = (i: number, delta: number) => {
    const next = [...state.fields];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("fields", next);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="panel p-6">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={state.name}
              onChange={(e) => set("name", e.target.value)}
              className="field max-w-[320px] text-[15px] font-semibold"
              placeholder="Nombre interno"
            />
            <button
              onClick={() => set("active", !state.active)}
              className="flex h-[26px] w-[46px] items-center rounded-full p-0"
              style={{
                background: state.active ? GOLD : "#1A1A1A",
                border: `1px solid ${state.active ? GOLD : "rgba(245,245,245,0.12)"}`,
                justifyContent: state.active ? "flex-end" : "flex-start",
              }}
            >
              <span
                className="mx-[3px] h-[18px] w-[18px] rounded-full"
                style={{ background: state.active ? "#080808" : "#5A5A5A" }}
              />
            </button>
            <span className="text-[12px]" style={{ color: state.active ? GOLD : "#8A8A8A" }}>
              {state.active ? "Publicado" : "Sin publicar"}
            </span>
            <div className="flex-1" />
            <span className="text-[11.5px] text-ink-400">{state.submissions} envíos</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Dirección pública">
              <div className="flex items-center rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-2.5">
                <span className="shrink-0 text-[11.5px] text-ink-500">/f/</span>
                <input
                  value={state.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  className="w-full border-none bg-transparent py-3 text-[13px] text-ink-50 outline-none"
                />
              </div>
            </Field>
            <Field label="Etiquetas que se aplican">
              <input
                value={state.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12)
                  )
                }
                className="field"
                placeholder="inbound, web"
              />
            </Field>
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Contenido</div>
          <div className="mt-3 grid gap-3">
            <Field label="Título">
              <input
                value={state.title}
                onChange={(e) => set("title", e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Descripción">
              <input
                value={state.description}
                onChange={(e) => set("description", e.target.value)}
                className="field"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Texto del botón">
                <input
                  value={state.submit_label}
                  onChange={(e) => set("submit_label", e.target.value)}
                  className="field"
                />
              </Field>
              <Field label="Redirigir tras enviar (opcional)">
                <input
                  value={state.redirect_url}
                  onChange={(e) => set("redirect_url", e.target.value)}
                  className="field"
                  placeholder="https://…"
                />
              </Field>
            </div>
            <Field label="Mensaje de gracias">
              <input
                value={state.success_message}
                onChange={(e) => set("success_message", e.target.value)}
                className="field"
              />
            </Field>
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Campos</div>
          <div className="mt-3 flex flex-col gap-2">
            {state.fields.map((f, i) => (
              <div
                key={f.key}
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-hair bg-ink-800 p-2.5"
              >
                <code className="rounded border border-hair bg-ink-900 px-1.5 py-[2px] font-mono text-[10.5px] text-ink-400">
                  {f.key}
                </code>
                <input
                  value={f.label}
                  onChange={(e) => setField(i, { label: e.target.value })}
                  className="min-w-[140px] flex-1 rounded-[7px] border border-[rgba(245,245,245,0.1)] bg-ink-925 px-2 py-1 text-[12.5px] outline-none"
                />
                <select
                  value={f.type}
                  onChange={(e) => setField(i, { type: e.target.value as FormField["type"] })}
                  className="rounded-[7px] border border-[rgba(245,245,245,0.1)] bg-ink-925 px-2 py-1 text-[12px] outline-none"
                >
                  <option value="text">texto</option>
                  <option value="email">email</option>
                  <option value="tel">teléfono</option>
                  <option value="textarea">párrafo</option>
                </select>
                <label className="flex items-center gap-1.5 text-[11.5px] text-ink-350">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => setField(i, { required: e.target.checked })}
                    className="h-[13px] w-[13px] accent-[#FAC51C]"
                  />
                  obligatorio
                </label>
                <button onClick={() => move(i, -1)} className="px-1 text-[11px] text-ink-500 hover:text-gold">↑</button>
                <button onClick={() => move(i, 1)} className="px-1 text-[11px] text-ink-500 hover:text-gold">↓</button>
                <button
                  onClick={() => set("fields", state.fields.filter((_, idx) => idx !== i))}
                  disabled={f.key === "name"}
                  className="px-1 text-[12px] text-ink-500 hover:text-[#FF8F7A] disabled:opacity-30"
                  title={f.key === "name" ? "El nombre es obligatorio" : "Quitar"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-hair pt-3">
            {BUILTIN.filter((b) => !state.fields.some((f) => f.key === b.key)).map((b) => (
              <button
                key={b.key}
                onClick={() => addField(b.key)}
                className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 hover:border-gold hover:text-gold"
              >
                + {b.label}
              </button>
            ))}
            <button
              onClick={() => {
                const k = window.prompt("Clave del campo personalizado (sin espacios):");
                if (k?.trim()) addField(k.trim().toLowerCase().replace(/\s+/g, "_"));
              }}
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 hover:border-gold hover:text-gold"
            >
              + Campo personalizado
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              start(async () => {
                const res = await saveForm(state.id, {
                  name: state.name,
                  slug: state.slug,
                  title: state.title,
                  description: state.description,
                  fields: state.fields,
                  submit_label: state.submit_label,
                  success_message: state.success_message,
                  redirect_url: state.redirect_url,
                  tags: state.tags,
                  active: state.active,
                });
                if (res?.error) toast(res.error, "error");
                else {
                  toast("Formulario guardado.");
                  router.refresh();
                }
              })
            }
            className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 hover:bg-gold-hover"
          >
            Guardar
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 hover:text-gold"
          >
            Ver publicado
          </a>
          <div className="flex-1" />
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar "${state.name}"`,
                message: "Los contactos que ya entraron se conservan.",
                confirmLabel: "Eliminar",
                danger: true,
              });
              if (!ok) return;
              start(async () => {
                await deleteForm(state.id);
                toast("Formulario eliminado.");
                router.push("/forms");
              });
            }}
            className="text-[12.5px] text-ink-350 hover:text-[#FF8F7A]"
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* vista previa y compartir */}
      <div className="flex flex-col gap-4">
        <div className="panel p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-350">Vista previa</div>
          <div className="mt-3 rounded-[12px] border border-hair bg-ink-925 p-5">
            <div className="text-[17px] font-semibold tracking-[-0.02em]">{state.title}</div>
            {state.description && (
              <div className="mt-1.5 text-[12.5px] leading-[1.6] text-ink-350">
                {state.description}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {state.fields.map((f) => (
                <div key={f.key}>
                  <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">
                    {f.label} {f.required && "·"}
                  </div>
                  {f.type === "textarea" ? (
                    <div className="h-[70px] rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-900" />
                  ) : (
                    <div className="h-[42px] rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-900" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[10px] bg-gold py-3 text-center text-[13px] font-semibold text-ink-950">
              {state.submit_label}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-350">Compartir</div>
          <Copy label="Enlace directo" value={publicUrl} toast={toast} />
          <Copy label="Insertar en tu web" value={embed} toast={toast} mono />
          <p className="mt-3 text-[11px] leading-[1.6] text-ink-450">
            Cada envío crea el contacto (sin duplicar si el email ya existe), lo registra en su
            timeline y dispara las automatizaciones con el disparador «Se envía un formulario».
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">{label}</div>
      {children}
    </div>
  );
}

function Copy({
  label,
  value,
  toast,
  mono,
}: {
  label: string;
  value: string;
  toast: (t: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] text-ink-400">{label}</div>
      <div className="flex items-start gap-2">
        <code
          className={`min-w-0 flex-1 break-all rounded-[8px] border border-hair bg-ink-925 px-2.5 py-2 text-[11px] text-ink-150 ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast("Copiado.");
          }}
          className="shrink-0 rounded-[8px] border border-[rgba(245,245,245,0.12)] px-2.5 py-2 text-[11px] text-ink-150 hover:text-gold"
        >
          Copiar
        </button>
      </div>
    </div>
  );
}
