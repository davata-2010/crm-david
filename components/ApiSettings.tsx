"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import {
  createCustomField,
  deleteCustomField,
  regenerateApiKey,
} from "@/app/actions";
import type { CustomField, Workspace } from "@/lib/types";
import { LEADS_URL } from "@/lib/config";

const TYPES: { key: CustomField["type"]; label: string }[] = [
  { key: "text", label: "Texto" },
  { key: "number", label: "Número" },
  { key: "date", label: "Fecha" },
  { key: "select", label: "Desplegable" },
  { key: "checkbox", label: "Casilla" },
];

export function FieldsSettings({
  fields,
  isAdmin,
}: {
  fields: CustomField[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [type, setType] = useState<CustomField["type"]>("text");

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            start(async () => {
              const res = await createCustomField(fd);
              if (res?.error) toast(res.error, "error");
              else {
                form.reset();
                toast("Campo creado.");
                router.refresh();
              }
            });
          }}
          className="panel p-[26px]"
        >
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Nuevo campo personalizado
          </div>
          <div className="mt-1 text-[12.5px] text-ink-350">
            Aparece en el formulario y en la ficha de la entidad que elijas.
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input name="label" className="field" placeholder="Presupuesto anual" required />
            <select name="entity" className="field" defaultValue="contacts">
              <option value="contacts">En contactos</option>
              <option value="deals">En deals</option>
            </select>
            <select
              name="type"
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value as CustomField["type"])}
            >
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
            >
              Crear campo
            </button>
          </div>
          {type === "select" && (
            <input
              name="options"
              className="field mt-3"
              placeholder="Opciones separadas por comas: Alto, Medio, Bajo"
            />
          )}
        </form>
      )}

      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Campos definidos</div>
        <div className="mt-3">
          {fields.length === 0 && (
            <div className="py-6 text-[12.5px] text-ink-400">
              Ninguno todavía. Los campos personalizados te dejan guardar lo que tu agencia
              mide y el esquema base no contempla.
            </div>
          )}
          {fields.map((f) => (
            <div key={f.id} className="hair-t flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{f.label}</div>
                <div className="text-[11.5px] text-ink-400">
                  {f.entity === "contacts" ? "Contactos" : "Deals"} ·{" "}
                  {TYPES.find((t) => t.key === f.type)?.label}
                  {f.options.length > 0 ? ` · ${f.options.join(", ")}` : ""}
                </div>
              </div>
              <code className="rounded border border-hair bg-ink-800 px-2 py-[2px] font-mono text-[10.5px] text-ink-350">
                {f.key}
              </code>
              {isAdmin && (
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Eliminar el campo "${f.label}"`,
                      message:
                        "Deja de mostrarse en formularios y fichas. Los valores ya guardados se conservan en la base de datos.",
                      confirmLabel: "Eliminar",
                      danger: true,
                    });
                    if (!ok) return;
                    start(async () => {
                      const res = await deleteCustomField(f.id);
                      if (res?.error) toast(res.error, "error");
                      else {
                        toast("Campo eliminado.");
                        router.refresh();
                      }
                    });
                  }}
                  className="text-[11.5px] text-ink-350 transition-colors hover:text-[#FF8F7A]"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ApiSettings({
  workspace,
  isAdmin,
}: {
  workspace: Workspace;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [shown, setShown] = useState(false);

  const masked = workspace.api_key.slice(0, 13) + "·".repeat(18) + workspace.api_key.slice(-4);

  const snippet = `curl -X POST ${LEADS_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${shown ? workspace.api_key : "TU_CLAVE"}" \\
  -d '{
    "name": "Elena Vidal",
    "email": "elena@northbeam.io",
    "company": "Northbeam",
    "phone": "+34 611 88 04 21",
    "source": "Landing de agentes",
    "tags": "inbound,web",
    "message": "Quiere automatizar 18k tickets al mes."
  }'`;

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Clave de API</div>
        <div className="mt-1 text-[12.5px] leading-[1.6] text-ink-350">
          Úsala para meter leads en este workspace desde tus agentes, formularios o
          automatizaciones. Trátala como una contraseña: quien la tenga puede crear contactos
          aquí.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-[13px] py-3 font-mono text-[12.5px] text-ink-150">
            {shown ? workspace.api_key : masked}
          </code>
          <button
            onClick={() => setShown((v) => !v)}
            className="rounded-[10px] border border-[rgba(245,245,245,0.1)] px-4 py-3 text-[12.5px] text-ink-150 transition-colors hover:text-gold"
          >
            {shown ? "Ocultar" : "Mostrar"}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(workspace.api_key);
              toast("Clave copiada.");
            }}
            className="rounded-[10px] border border-[rgba(245,245,245,0.1)] px-4 py-3 text-[12.5px] text-ink-150 transition-colors hover:text-gold"
          >
            Copiar
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Rotar la clave de API",
                  message:
                    "La clave actual dejará de funcionar inmediatamente. Tendrás que actualizarla en todas tus integraciones.",
                  confirmLabel: "Rotar clave",
                  danger: true,
                });
                if (!ok) return;
                start(async () => {
                  const res = await regenerateApiKey();
                  if (res?.error) toast(res.error, "error");
                  else {
                    toast("Clave rotada.");
                    router.refresh();
                  }
                });
              }}
              className="rounded-[10px] border border-[rgba(255,143,122,0.3)] px-4 py-3 text-[12.5px] text-[#FF8F7A] transition-colors hover:bg-[rgba(255,143,122,0.1)]"
            >
              Rotar
            </button>
          )}
        </div>
      </div>

      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Captación de leads</div>
        <div className="mt-1 text-[12.5px] text-ink-350">
          <code className="font-mono text-ink-150">POST {LEADS_URL}</code> — crea el
          contacto, la empresa si no existe, y registra la primera actividad. Si el email ya
          existe no duplica: añade una actividad al contacto que ya tienes.
        </div>
        <pre className="mt-4 overflow-x-auto rounded-[10px] border border-hair bg-ink-925 p-4 font-mono text-[11.5px] leading-[1.6] text-ink-150">
          {snippet}
        </pre>
        <button
          onClick={() => {
            navigator.clipboard.writeText(snippet.replace("TU_CLAVE", workspace.api_key));
            toast("Ejemplo copiado con tu clave.");
          }}
          className="mt-3 rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[12.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
        >
          Copiar ejemplo con mi clave
        </button>

        <div className="mt-5 border-t border-hair pt-4 text-[11.5px] leading-[1.7] text-ink-400">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-350">
            Campos aceptados
          </div>
          <code className="font-mono">name</code> (obligatorio) ·{" "}
          <code className="font-mono">email</code> · <code className="font-mono">phone</code> ·{" "}
          <code className="font-mono">company</code> · <code className="font-mono">role</code> ·{" "}
          <code className="font-mono">source</code> · <code className="font-mono">tags</code>{" "}
          (separadas por comas) · <code className="font-mono">message</code>
        </div>
      </div>
    </div>
  );
}
