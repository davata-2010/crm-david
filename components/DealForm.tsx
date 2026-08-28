"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeal, updateDeal, deleteDeal } from "@/app/actions";
import { GOLD, LOST, LOST_REASONS, PROJECT_TYPES, STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import { eur, shortDate } from "@/lib/format";
import type { Company, Contact, CustomField, Deal, Membership } from "@/lib/types";
import { dealHref } from "@/lib/routes";

type Opt = Pick<Company, "id" | "name">;

export default function DealForm({
  companies,
  contacts,
  deal,
  defaultContactId,
  defaultCompanyId,
  defaultStage,
  members = [],
  fields = [],
}: {
  companies: Opt[];
  contacts: Pick<Contact, "id" | "name" | "company_id">[];
  deal?: Deal;
  defaultContactId?: string;
  defaultCompanyId?: string;
  defaultStage?: number;
  members?: Membership[];
  fields?: CustomField[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const initialContact =
    deal?.contact_id ?? defaultContactId ?? contacts[0]?.id ?? "";
  const initialCompany =
    deal?.company_id ??
    defaultCompanyId ??
    contacts.find((c) => c.id === initialContact)?.company_id ??
    companies[0]?.id ??
    "";

  const [form, setForm] = useState({
    name: deal?.name ?? "",
    company_id: initialCompany,
    contact_id: initialContact,
    value: deal ? String(Math.round(Number(deal.value))) : "",
    close_date: deal?.close_date ?? "",
    stage: STAGES[deal?.stage ?? defaultStage ?? 1],
    project_type: deal?.project_type ?? "Agentes",
    notes: deal?.notes ?? "",
    tags: (deal?.tags ?? []).join(", "),
    lost_reason: deal?.lost_reason ?? "",
    assigned_to: deal?.assigned_to ?? "",
  });

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setStatus(null);
  };

  const valueNum = useMemo(
    () => parseInt(String(form.value).replace(/\D/g, ""), 10),
    [form.value]
  );
  const stageIndex = STAGES.indexOf(form.stage as (typeof STAGES)[number]);
  const companyName = companies.find((c) => c.id === form.company_id)?.name ?? "Sin empresa";
  const contactName = contacts.find((c) => c.id === form.contact_id)?.name ?? "—";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    // Los campos personalizados viven fuera del estado controlado.
    new FormData(e.currentTarget as HTMLFormElement).forEach((v, k) => {
      if (k.startsWith("custom__")) fd.set(k, String(v));
    });
    start(async () => {
      setError(null);
      const res = deal ? await updateDeal(deal.id, fd) : await createDeal(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (deal) {
        setStatus("Cambios guardados.");
        router.refresh();
      } else {
        router.push(dealHref((res as { id: string }).id));
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid max-w-[1000px] grid-cols-1 items-start gap-4 lg:grid-cols-[1.5fr_1fr]"
    >
      <div className="panel p-7">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">
          {deal ? "Editar deal" : "Detalles del deal"}
        </div>
        <div className="mt-1 text-[12.5px] text-ink-350">
          Los campos marcados con · son obligatorios.
        </div>

        <div className="mt-[26px] grid gap-[18px]">
          <Label text="Nombre del deal ·">
            <input
              className="field"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Agente de soporte con RAG"
              required
            />
          </Label>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Label text="Cuenta ·">
              <select
                className="field"
                value={form.company_id}
                onChange={(e) => set("company_id")(e.target.value)}
              >
                <option value="">Sin empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Contacto principal">
              <select
                className="field"
                value={form.contact_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const company = contacts.find((c) => c.id === id)?.company_id;
                  setForm((p) => ({
                    ...p,
                    contact_id: id,
                    company_id: company ?? p.company_id,
                  }));
                }}
              >
                <option value="">Sin contacto</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Label text="Valor ·">
              <div className="flex items-center rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] focus-within:border-gold">
                <span className="text-[13.5px] font-semibold text-gold">€</span>
                <input
                  className="tnum flex-1 border-none bg-transparent px-[9px] py-3 text-[13.5px] text-ink-50 outline-none"
                  value={form.value}
                  onChange={(e) => set("value")(e.target.value)}
                  placeholder="48000"
                  inputMode="numeric"
                  required
                />
              </div>
            </Label>
            <Label text="Cierre estimado">
              <input
                type="date"
                className="field"
                style={{ colorScheme: "dark" }}
                value={form.close_date ?? ""}
                onChange={(e) => set("close_date")(e.target.value)}
              />
            </Label>
          </div>

          <Chips
            label="Etapa"
            options={[...STAGES]}
            value={form.stage}
            onChange={set("stage")}
          />
          <Chips
            label="Tipo de proyecto"
            options={PROJECT_TYPES}
            value={form.project_type}
            onChange={set("project_type")}
          />

          {stageIndex === LOST && (
            <Chips
              label="Motivo de la pérdida"
              options={LOST_REASONS}
              value={form.lost_reason}
              onChange={set("lost_reason")}
            />
          )}

          {members.length > 0 && (
            <Label text="Responsable">
              <select
                className="field"
                value={form.assigned_to}
                onChange={(e) => set("assigned_to")(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || m.profile?.email || "Miembro"}
                  </option>
                ))}
              </select>
            </Label>
          )}

          <Label text="Etiquetas">
            <input
              className="field"
              value={form.tags}
              onChange={(e) => set("tags")(e.target.value)}
              placeholder="urgente, upsell, q4"
            />
          </Label>

          <CustomFields fields={fields} values={deal?.custom ?? {}} />

          <Label text="Notas">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Contexto, stack, riesgos, quién decide…"
              className="min-h-[92px] w-full resize-y rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] py-3 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-gold"
            />
          </Label>
        </div>

        {error && (
          <div className="mt-4 rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
            {error}
          </div>
        )}

        <div className="mt-[26px] flex items-center gap-3 border-t border-hair pt-[22px]">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-gold px-[22px] py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
          >
            {pending ? "Guardando…" : deal ? "Guardar cambios" : "Crear deal"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/pipeline")}
            className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-5 py-3 text-[13.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          {deal ? (
            <button
              type="button"
              onClick={() => {
                if (!confirm(`¿Eliminar el deal "${deal.name}"?`)) return;
                start(async () => {
                  const res = await deleteDeal(deal.id);
                  if (res?.error) setError(res.error);
                  else router.push("/pipeline");
                });
              }}
              className="text-[12.5px] text-ink-350 transition-colors hover:text-gold"
            >
              Eliminar deal
            </button>
          ) : (
            <div className="text-[12px] text-ink-400">
              {status ?? "Se asignará a tu usuario."}
            </div>
          )}
        </div>
        {deal && status && (
          <div className="mt-3 text-[12px] text-ink-400">{status}</div>
        )}
      </div>

      {/* Resumen en vivo */}
      <div className="flex flex-col gap-4">
        <div className="panel p-6">
          <div className="text-[11px] uppercase tracking-[0.1em] text-ink-300">Resumen</div>
          <div className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
            {form.name || "Deal sin título"}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-350">{companyName}</div>
          <div className="tnum mt-[18px] text-[32px] font-semibold tracking-[-0.035em] text-gold">
            {isNaN(valueNum) ? "€—" : eur(valueNum)}
          </div>
          <div className="mt-[18px] flex flex-col gap-2.5">
            {[
              { label: "Etapa", value: form.stage },
              { label: "Probabilidad", value: `${STAGE_PROBABILITY[Math.max(0, stageIndex)]}%` },
              { label: "Tipo", value: form.project_type },
              { label: "Contacto", value: contactName },
              { label: "Cierre", value: form.close_date ? shortDate(form.close_date) : "—" },
            ].map((p) => (
              <div
                key={p.label}
                className="hair-t flex justify-between pt-2.5 text-[12.5px]"
              >
                <span className="text-ink-350">{p.label}</span>
                <span className="text-ink-100">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl2 border border-[rgba(250,197,28,0.18)] bg-ink-915 px-[22px] py-5">
          <div className="text-[12.5px] font-semibold text-gold">Nota interna</div>
          <div className="mt-2 text-[12.5px] leading-[1.6] text-ink-250">
            Los deals por encima de €40.000 requieren revisión de capacidad del equipo de
            delivery antes de pasar a propuesta.
          </div>
        </div>
      </div>
    </form>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-ink-300">{text}</div>
      {children}
    </div>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-[9px] text-[11px] uppercase tracking-[0.1em] text-ink-300">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className="rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors"
              style={{
                background: active ? GOLD : "#111111",
                color: active ? "#080808" : "#B4B4B4",
                border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomFields({
  fields,
  values,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
}) {
  if (fields.length === 0) return null;
  return (
    <div>
      <div className="mb-[9px] text-[11px] uppercase tracking-[0.1em] text-ink-300">
        Campos personalizados
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {fields.map((f) => {
          const name = `custom__${f.key}`;
          const value = values?.[f.key];
          if (f.type === "select")
            return (
              <div key={f.id}>
                <div className="mb-1.5 text-[11px] text-ink-350">{f.label}</div>
                <select name={name} className="field" defaultValue={String(value ?? "")}>
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            );
          if (f.type === "checkbox")
            return (
              <label key={f.id} className="mt-6 flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  name={name}
                  value="si"
                  defaultChecked={String(value) === "si"}
                  className="h-[13px] w-[13px] accent-[#FAC51C]"
                />
                {f.label}
              </label>
            );
          return (
            <div key={f.id}>
              <div className="mb-1.5 text-[11px] text-ink-350">{f.label}</div>
              <input
                name={name}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                style={f.type === "date" ? { colorScheme: "dark" } : undefined}
                className="field"
                defaultValue={String(value ?? "")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
