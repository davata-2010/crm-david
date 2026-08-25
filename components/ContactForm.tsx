"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createContact, updateContact, deleteContact } from "@/app/actions";
import { STATUS, type ContactStatus } from "@/lib/constants";
import type { Company, Contact } from "@/lib/types";

const STATUSES: ContactStatus[] = ["lead", "prospect", "customer"];

export default function ContactForm({
  companies,
  contact,
  defaultCompanyId,
  onDone,
}: {
  companies: Pick<Company, "id" | "name">[];
  contact?: Contact;
  defaultCompanyId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const done = onDone ?? (() => router.replace(pathname));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ContactStatus>(contact?.status ?? "lead");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("status", status);
    start(async () => {
      setError(null);
      const res = contact ? await updateContact(contact.id, fd) : await createContact(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (contact) {
        router.refresh();
        done();
      } else {
        router.push(`/contacts/${(res as { id: string }).id}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-[18px]">
      <Field label="Nombre ·">
        <input
          name="name"
          className="field"
          defaultValue={contact?.name}
          placeholder="Elena Vidal"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Email">
          <input
            name="email"
            type="email"
            className="field"
            defaultValue={contact?.email ?? ""}
            placeholder="elena@northbeam.io"
          />
        </Field>
        <Field label="Teléfono">
          <input
            name="phone"
            className="field"
            defaultValue={contact?.phone ?? ""}
            placeholder="+34 611 88 04 21"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Cargo">
          <input
            name="role"
            className="field"
            defaultValue={contact?.role ?? ""}
            placeholder="VP Operations"
          />
        </Field>
        <Field label="Empresa">
          <select name="company_id" className="field" defaultValue={contact?.company_id ?? defaultCompanyId ?? ""}>
            <option value="">Sin empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <div className="mb-[9px] text-[11px] uppercase tracking-[0.1em] text-ink-300">
          Estado
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const active = status === s;
            const b = STATUS[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? b.bg : "#111111",
                  color: active ? b.fg : "#B4B4B4",
                  border: `1px solid ${active ? b.border : "rgba(245,245,245,0.1)"}`,
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Origen">
          <input
            name="source"
            className="field"
            defaultValue={contact?.source ?? ""}
            placeholder="LinkedIn orgánico"
          />
        </Field>
        <Field label="Zona horaria">
          <input
            name="timezone"
            className="field"
            defaultValue={contact?.timezone ?? "CET · Madrid"}
          />
        </Field>
      </div>

      <Field label="Etiquetas">
        <input
          name="tags"
          className="field"
          defaultValue={(contact?.tags ?? []).join(", ")}
          placeholder="enterprise, inbound, prioridad alta"
        />
        <div className="mt-1.5 text-[11px] text-ink-500">
          Separadas por comas. Máximo 12.
        </div>
      </Field>

      {error && (
        <div className="rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12.5px] text-gold">
          {error}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 border-t border-hair pt-[22px]">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-gold px-[22px] py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {pending ? "Guardando…" : contact ? "Guardar cambios" : "Crear contacto"}
        </button>
        <button
          type="button"
          onClick={() => (contact ? done() : router.back())}
          className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-5 py-3 text-[13.5px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        >
          Cancelar
        </button>
        <div className="flex-1" />
        {contact && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`¿Eliminar a ${contact.name} y todas sus actividades?`)) return;
              start(async () => {
                const res = await deleteContact(contact.id);
                if (res?.error) setError(res.error);
                else router.push("/contacts");
              });
            }}
            className="text-[12.5px] text-ink-350 transition-colors hover:text-gold"
          >
            Eliminar contacto
          </button>
        )}
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
