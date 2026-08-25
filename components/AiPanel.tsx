"use client";

import { useState } from "react";
import { useChrome } from "@/components/AppChrome";
import { GOLD } from "@/lib/constants";

type Action = "resumen" | "email" | "score";

const BUTTONS: { key: Action; label: string; hint: string }[] = [
  { key: "resumen", label: "Resumir cuenta", hint: "Dónde está y cuál es el siguiente paso" },
  { key: "email", label: "Borrador de email", hint: "Seguimiento con el historial real" },
  { key: "score", label: "Puntuar lead", hint: "Nota de 0 a 100 y riesgo principal" },
];

export default function AiPanel({
  contactId,
  dealId,
}: {
  contactId?: string;
  dealId?: string;
}) {
  const { toast } = useChrome();
  const [busy, setBusy] = useState<Action | null>(null);
  const [result, setResult] = useState<{ label: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, contactId, dealId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "No se pudo generar.");
      else setResult({ label: data.label, text: data.text });
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel px-[22px] pb-[18px] pt-[22px]">
      <div className="flex items-center gap-2">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-gold text-[11px] font-bold text-ink-950">
          ✦
        </span>
        <div className="flex-1 text-[14px] font-semibold">Asistente</div>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-400">
        Lee la ficha y el historial de este registro y responde sobre lo que hay, sin inventar.
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.key}
            disabled={busy !== null}
            onClick={() => run(b.key)}
            className="rounded-[10px] border border-hair bg-ink-800 px-3.5 py-2.5 text-left transition-colors hover:border-[rgba(250,197,28,0.45)] disabled:opacity-50"
          >
            <div className="text-[12.5px] font-medium" style={{ color: GOLD }}>
              {busy === b.key ? "Pensando…" : b.label}
            </div>
            <div className="mt-[2px] text-[11px] text-ink-400">{b.hint}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-[10px] border border-[rgba(250,197,28,0.25)] bg-[rgba(250,197,28,0.06)] px-3 py-2.5 text-[12px] leading-[1.55] text-gold">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-[10px] border border-hair bg-ink-925 px-3.5 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-[0.1em] text-ink-350">
              {result.label}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.text);
                toast("Copiado al portapapeles.");
              }}
              className="text-[11px] text-ink-400 transition-colors hover:text-gold"
            >
              Copiar
            </button>
            <button
              onClick={() => setResult(null)}
              className="text-[11px] text-ink-500 transition-colors hover:text-gold"
            >
              Cerrar
            </button>
          </div>
          <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.6] text-ink-100">
            {result.text}
          </div>
        </div>
      )}
    </div>
  );
}
