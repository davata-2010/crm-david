"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { saveIntegration, testIntegration } from "@/app/integrations";
import { GOLD } from "@/lib/constants";
import { relative } from "@/lib/format";

export type Integration = {
  id: string;
  provider: "n8n" | "make";
  base_url: string;
  api_key: string;
  team_id: string;
  active: boolean;
  last_check: string | null;
  last_error: string | null;
};

const EMPTY = {
  base_url: "",
  api_key: "",
  team_id: "",
  active: false,
  last_check: null,
  last_error: null,
};

export default function IntegrationsSettings({
  n8n,
  make,
  origin,
}: {
  n8n: Integration | null;
  make: Integration | null;
  origin: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card
        provider="n8n"
        title="n8n"
        blurb="Cada automatización de Aurum puede reflejarse como un workflow real en tu n8n, y se ejecuta allí. Necesitas una instancia accesible desde internet y una clave de API (Settings → n8n API → Create an API key)."
        value={n8n ?? { ...EMPTY, id: "", provider: "n8n" }}
        canTest
      />

      <Card
        provider="make"
        title="Make"
        blurb="Make no permite crear escenarios por API sin plan de equipo, así que la sincronización automática no es posible. Desde cada automatización puedes descargar su blueprint e importarlo en Make: el escenario resultante funciona igual."
        value={make ?? { ...EMPTY, id: "", provider: "make" }}
        canTest={false}
      />

      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">
          Cómo encaja todo
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12.5px] leading-[1.65] text-ink-250">
          <li>
            Aurum detecta el disparador y comprueba las condiciones. Eso se queda
            aquí: es quien conoce tus datos.
          </li>
          <li>
            Llama al webhook del workflow externo con el registro completo, en{" "}
            <code className="font-mono text-ink-350">
              {"{ workflow, entity, record }"}
            </code>
            .
          </li>
          <li>
            El workflow ejecuta los pasos llamando a{" "}
            <code className="font-mono text-ink-350">{origin}/api/automation/action</code>{" "}
            con la clave de API del workspace.
          </li>
          <li>
            A partir de ahí puedes añadir en n8n o Make cualquier otro nodo:
            enviar un email, un SMS, publicar en Slack, lo que necesites.
          </li>
        </ol>
        <p className="mt-3 text-[11.5px] leading-[1.6] text-ink-450">
          La clave del workspace viaja dentro del workflow generado, en la
          cabecera de cada nodo HTTP. Trátalo como material sensible y no
          compartas ese JSON con nadie ajeno.
        </p>
      </div>
    </div>
  );
}

function Card({
  provider,
  title,
  blurb,
  value,
  canTest,
}: {
  provider: "n8n" | "make";
  title: string;
  blurb: string;
  value: Omit<Integration, "id" | "provider"> & { id: string; provider: string };
  canTest: boolean;
}) {
  const router = useRouter();
  const { toast } = useChrome();
  const [, start] = useTransition();

  const [baseUrl, setBaseUrl] = useState(value.base_url);
  const [apiKey, setApiKey] = useState(value.api_key);
  const [teamId, setTeamId] = useState(value.team_id);
  const [active, setActive] = useState(value.active);
  const [shown, setShown] = useState(false);

  const masked = apiKey ? apiKey.slice(0, 6) + "·".repeat(14) + apiKey.slice(-4) : "";

  return (
    <div className="panel p-[26px]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">{title}</div>
        <button
          onClick={() => setActive(!active)}
          className="flex h-[24px] w-[42px] items-center rounded-full p-0"
          style={{
            background: active ? GOLD : "#1A1A1A",
            border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.12)"}`,
            justifyContent: active ? "flex-end" : "flex-start",
          }}
        >
          <span
            className="mx-[3px] h-[16px] w-[16px] rounded-full"
            style={{ background: active ? "#080808" : "#5A5A5A" }}
          />
        </button>
        <span className="text-[12px]" style={{ color: active ? GOLD : "#8A8A8A" }}>
          {active ? "Conectado" : "Desconectado"}
        </span>
        <div className="flex-1" />
        {value.last_check && (
          <span className="text-[11px] text-ink-450">
            comprobado {relative(value.last_check)}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[12.5px] leading-[1.6] text-ink-350">{blurb}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">
            {provider === "n8n" ? "URL de tu n8n" : "Zona de Make"}
          </div>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="field"
            placeholder={provider === "n8n" ? "https://n8n.midominio.com" : "https://eu1.make.com"}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">
            Clave de API
          </div>
          <div className="flex gap-2">
            <input
              value={shown ? apiKey : apiKey ? masked : ""}
              onChange={(e) => setApiKey(e.target.value)}
              onFocus={() => setShown(true)}
              className="field"
              placeholder="n8n_api_…"
            />
            {apiKey && (
              <button
                onClick={() => setShown((v) => !v)}
                className="shrink-0 rounded-[10px] border border-[rgba(245,245,245,0.12)] px-3 text-[12px] text-ink-150 hover:text-gold"
              >
                {shown ? "Ocultar" : "Ver"}
              </button>
            )}
          </div>
        </div>
      </div>

      {provider === "make" && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-300">
            ID de equipo (opcional)
          </div>
          <input
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="field max-w-[240px]"
          />
        </div>
      )}

      {value.last_error && (
        <div className="mt-3 rounded-[10px] border border-[rgba(255,143,122,0.3)] bg-[rgba(255,143,122,0.06)] px-3 py-2.5 text-[12px] text-[#FF8F7A]">
          {value.last_error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            start(async () => {
              const res = await saveIntegration(provider, {
                base_url: baseUrl,
                api_key: apiKey,
                team_id: teamId,
                active,
              });
              if (res?.error) toast(res.error, "error");
              else {
                toast("Integración guardada.");
                router.refresh();
              }
            })
          }
          className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 hover:bg-gold-hover"
        >
          Guardar
        </button>
        {canTest && (
          <button
            onClick={() =>
              start(async () => {
                const res = await testIntegration(provider);
                if (res?.error) toast(res.error, "error");
                else {
                  toast(res.info ?? "Conexión correcta.");
                  router.refresh();
                }
              })
            }
            className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 hover:border-gold hover:text-gold"
          >
            Probar conexión
          </button>
        )}
      </div>
    </div>
  );
}
