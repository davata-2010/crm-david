"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { saveWorkflow, deleteWorkflow, toggleWorkflow } from "@/app/automations";
import { GOLD, CONTACT_STATUSES, STAGES, STATUS } from "@/lib/constants";
import { STEP_LABEL, TRIGGERS, type Step, type TriggerKey, type WorkflowRow } from "@/lib/workflows";
import { OPS_BY_TYPE, OP_LABEL, OP_NEEDS_VALUE, type Condition, type FieldDef } from "@/lib/fields";
import type { Membership } from "@/lib/types";

const NEW_STEP: Record<Step["type"], Step> = {
  wait: { type: "wait", days: 1 },
  add_tag: { type: "add_tag", value: "" },
  remove_tag: { type: "remove_tag", value: "" },
  set_status: { type: "set_status", value: "prospect" },
  set_stage: { type: "set_stage", value: "1" },
  assign: { type: "assign", value: "" },
  create_task: { type: "create_task", title: "Llamar a {{name}}", dueInDays: 1, kind: "Tarea" },
  add_note: { type: "add_note", title: "Nota automática", body: "" },
  create_deal: { type: "create_deal", name: "Deal de {{name}}", value: 0, stage: "0" },
  webhook: { type: "webhook", url: "https://" },
};

export default function WorkflowEditor({
  workflow,
  fields,
  members,
  forms,
}: {
  workflow: WorkflowRow;
  fields: FieldDef[];
  members: Membership[];
  forms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { confirm, toast } = useChrome();
  const [, start] = useTransition();

  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [trigger, setTrigger] = useState<TriggerKey>(workflow.trigger);
  const [cfg, setCfg] = useState<Record<string, string>>(workflow.trigger_config ?? {});
  const [conditions, setConditions] = useState<Condition[]>(workflow.conditions ?? []);
  const [steps, setSteps] = useState<Step[]>(workflow.steps ?? []);
  const [active, setActive] = useState(workflow.active);

  const def = TRIGGERS.find((t) => t.key === trigger)!;

  function save() {
    start(async () => {
      const res = await saveWorkflow(workflow.id, {
        name,
        description,
        trigger,
        trigger_config: cfg,
        conditions,
        steps,
        active,
      });
      if (res?.error) toast(res.error, "error");
      else {
        toast("Automatización guardada.");
        router.refresh();
      }
    });
  }

  const setStep = (i: number, patch: Partial<Step>) =>
    setSteps(steps.map((s, idx) => (idx === i ? ({ ...s, ...patch } as Step) : s)));

  const move = (i: number, delta: number) => {
    const next = [...steps];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* cabecera */}
      <div className="panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field max-w-[360px] text-[15px] font-semibold"
            placeholder="Nombre de la automatización"
          />
          <button
            onClick={() => setActive(!active)}
            className="flex h-[26px] w-[46px] items-center rounded-full p-0"
            style={{
              background: active ? GOLD : "#1A1A1A",
              border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.12)"}`,
              justifyContent: active ? "flex-end" : "flex-start",
            }}
            title={active ? "Activa" : "Pausada"}
          >
            <span
              className="mx-[3px] h-[18px] w-[18px] rounded-full"
              style={{ background: active ? "#080808" : "#5A5A5A" }}
            />
          </button>
          <span className="text-[12px]" style={{ color: active ? GOLD : "#8A8A8A" }}>
            {active ? "Activa" : "Pausada"}
          </span>
          <div className="flex-1" />
          <span className="text-[11.5px] text-ink-400">
            {workflow.runs_count} ejecuciones
          </span>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field mt-3"
          placeholder="Para qué sirve (opcional)"
        />
      </div>

      {/* disparador */}
      <div className="panel p-6">
        <Badge n={1} label="Cuándo" />
        <div className="mt-3 flex flex-col gap-2">
          {TRIGGERS.map((t) => {
            const on = trigger === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTrigger(t.key);
                  setCfg({});
                }}
                className="rounded-[10px] border px-3.5 py-2.5 text-left transition-colors"
                style={{
                  borderColor: on ? "rgba(250,197,28,0.45)" : "rgba(245,245,245,0.08)",
                  background: on ? "rgba(250,197,28,0.06)" : "#1A1A1A",
                }}
              >
                <div className="text-[12.5px] font-medium" style={{ color: on ? GOLD : "#F5F5F5" }}>
                  {t.label}
                </div>
                <div className="mt-[2px] text-[11px] text-ink-400">{t.hint}</div>
              </button>
            );
          })}
        </div>

        {def.config && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-350">
              {def.config === "tag"
                ? "Sólo con esta etiqueta"
                : def.config === "status"
                  ? "Sólo al pasar a"
                  : def.config === "stage"
                    ? "Sólo al llegar a"
                    : "Sólo este formulario"}
            </div>
            {def.config === "tag" && (
              <input
                value={cfg.tag ?? ""}
                onChange={(e) => setCfg({ tag: e.target.value })}
                className="field max-w-[280px]"
                placeholder="Cualquier etiqueta si lo dejas vacío"
              />
            )}
            {def.config === "status" && (
              <select
                value={cfg.status ?? ""}
                onChange={(e) => setCfg({ status: e.target.value })}
                className="field max-w-[280px]"
              >
                <option value="">Cualquier estado</option>
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS[s].label}
                  </option>
                ))}
              </select>
            )}
            {def.config === "stage" && (
              <select
                value={cfg.stage ?? ""}
                onChange={(e) => setCfg({ stage: e.target.value })}
                className="field max-w-[280px]"
              >
                <option value="">Cualquier etapa</option>
                {STAGES.map((label, i) => (
                  <option key={label} value={String(i)}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {def.config === "form" && (
              <select
                value={cfg.form ?? ""}
                onChange={(e) => setCfg({ form: e.target.value })}
                className="field max-w-[280px]"
              >
                <option value="">Cualquier formulario</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* condiciones */}
      <div className="panel p-6">
        <Badge n={2} label="Sólo si" optional />
        <div className="mt-3 flex flex-col gap-2">
          {conditions.length === 0 && (
            <p className="text-[11.5px] text-ink-450">
              Sin condiciones: se ejecuta siempre que ocurra el disparador.
            </p>
          )}
          {conditions.map((c, i) => {
            const field = fields.find((f) => f.key === c.field) ?? fields[0];
            return (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <span className="w-[34px] text-[11px] text-ink-450">{i === 0 ? "si" : "y"}</span>
                <select
                  value={c.field}
                  onChange={(e) => {
                    const nf = fields.find((f) => f.key === e.target.value)!;
                    setConditions(
                      conditions.map((x, idx) =>
                        idx === i
                          ? { field: nf.key, op: OPS_BY_TYPE[nf.type][0], value: "" }
                          : x
                      )
                    );
                  }}
                  className="rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] outline-none"
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={c.op}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, idx) =>
                        idx === i ? { ...x, op: e.target.value as Condition["op"] } : x
                      )
                    )
                  }
                  className="rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] outline-none"
                >
                  {OPS_BY_TYPE[field.type].map((o) => (
                    <option key={o} value={o}>
                      {OP_LABEL[o]}
                    </option>
                  ))}
                </select>
                {OP_NEEDS_VALUE(c.op) && (
                  <input
                    value={c.value}
                    onChange={(e) =>
                      setConditions(
                        conditions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x))
                      )
                    }
                    className="min-w-[120px] flex-1 rounded-[7px] border border-[rgba(245,245,245,0.12)] bg-ink-900 px-2 py-1 text-[12px] outline-none"
                    placeholder="valor"
                  />
                )}
                <button
                  onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
                  className="px-1 text-[12px] text-ink-500 hover:text-[#FF8F7A]"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() =>
            setConditions([
              ...conditions,
              { field: fields[0].key, op: OPS_BY_TYPE[fields[0].type][0], value: "" },
            ])
          }
          className="mt-3 text-[12px] text-gold"
        >
          + Añadir condición
        </button>
      </div>

      {/* pasos */}
      <div className="panel p-6">
        <Badge n={3} label="Entonces" />

        <div className="mt-3 flex flex-col gap-2">
          {steps.length === 0 && (
            <p className="text-[11.5px] text-ink-450">
              Todavía no hace nada. Añade el primer paso abajo.
            </p>
          )}

          {steps.map((s, i) => (
            <div key={i} className="rounded-[11px] border border-hair bg-ink-800 p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-[20px] w-[20px] place-items-center rounded-full bg-ink-700 text-[10px] font-semibold text-ink-150">
                  {i + 1}
                </span>
                <span className="flex-1 text-[12.5px] font-medium">{STEP_LABEL[s.type]}</span>
                <button onClick={() => move(i, -1)} className="px-1 text-[11px] text-ink-500 hover:text-gold">↑</button>
                <button onClick={() => move(i, 1)} className="px-1 text-[11px] text-ink-500 hover:text-gold">↓</button>
                <button
                  onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                  className="px-1 text-[12px] text-ink-500 hover:text-[#FF8F7A]"
                >
                  ✕
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {s.type === "wait" && (
                  <>
                    <NumBox label="días" value={s.days ?? 0} onChange={(v) => setStep(i, { days: v })} />
                    <NumBox label="horas" value={s.hours ?? 0} onChange={(v) => setStep(i, { hours: v })} />
                    <NumBox label="min" value={s.minutes ?? 0} onChange={(v) => setStep(i, { minutes: v })} />
                  </>
                )}

                {(s.type === "add_tag" || s.type === "remove_tag") && (
                  <input
                    value={s.value}
                    onChange={(e) => setStep(i, { value: e.target.value })}
                    className="field max-w-[260px]"
                    placeholder="etiqueta"
                  />
                )}

                {s.type === "set_status" && (
                  <select
                    value={s.value}
                    onChange={(e) => setStep(i, { value: e.target.value })}
                    className="field max-w-[220px]"
                  >
                    {CONTACT_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {STATUS[x].label}
                      </option>
                    ))}
                  </select>
                )}

                {(s.type === "set_stage" || s.type === "create_deal") && (
                  <select
                    value={s.type === "set_stage" ? s.value : s.stage}
                    onChange={(e) =>
                      setStep(i, s.type === "set_stage" ? { value: e.target.value } : { stage: e.target.value })
                    }
                    className="field max-w-[220px]"
                  >
                    {STAGES.map((label, idx) => (
                      <option key={label} value={String(idx)}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}

                {s.type === "assign" && (
                  <select
                    value={s.value}
                    onChange={(e) => setStep(i, { value: e.target.value })}
                    className="field max-w-[260px]"
                  >
                    <option value="">Sin asignar</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name || m.profile?.email}
                      </option>
                    ))}
                  </select>
                )}

                {s.type === "create_task" && (
                  <>
                    <input
                      value={s.title}
                      onChange={(e) => setStep(i, { title: e.target.value })}
                      className="field min-w-[220px] flex-1"
                      placeholder="Título de la tarea"
                    />
                    <NumBox
                      label="días para vencer"
                      value={s.dueInDays}
                      onChange={(v) => setStep(i, { dueInDays: v })}
                    />
                  </>
                )}

                {s.type === "add_note" && (
                  <>
                    <input
                      value={s.title}
                      onChange={(e) => setStep(i, { title: e.target.value })}
                      className="field max-w-[240px]"
                      placeholder="Título"
                    />
                    <input
                      value={s.body}
                      onChange={(e) => setStep(i, { body: e.target.value })}
                      className="field min-w-[220px] flex-1"
                      placeholder="Texto de la nota"
                    />
                  </>
                )}

                {s.type === "create_deal" && (
                  <>
                    <input
                      value={s.name}
                      onChange={(e) => setStep(i, { name: e.target.value })}
                      className="field min-w-[200px] flex-1"
                      placeholder="Nombre del deal"
                    />
                    <NumBox label="€" value={s.value} onChange={(v) => setStep(i, { value: v })} />
                  </>
                )}

                {s.type === "webhook" && (
                  <input
                    value={s.url}
                    onChange={(e) => setStep(i, { url: e.target.value })}
                    className="field min-w-[260px] flex-1"
                    placeholder="https://tu-endpoint.com/hook"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hair pt-4">
          {(Object.keys(STEP_LABEL) as Step["type"][]).map((t) => (
            <button
              key={t}
              onClick={() => setSteps([...steps, { ...NEW_STEP[t] }])}
              className="rounded-full border border-[rgba(245,245,245,0.12)] px-3 py-1 text-[11.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
            >
              + {STEP_LABEL[t]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-[1.6] text-ink-450">
          En los textos puedes usar <code className="font-mono text-ink-350">{"{{name}}"}</code>,{" "}
          <code className="font-mono text-ink-350">{"{{email}}"}</code> o cualquier campo del
          registro; se sustituyen al ejecutarse.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
        >
          Guardar
        </button>
        <button
          onClick={() =>
            start(async () => {
              await toggleWorkflow(workflow.id, !active);
              setActive(!active);
              router.refresh();
            })
          }
          className="rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[13px] text-ink-150 hover:text-gold"
        >
          {active ? "Pausar" : "Activar"}
        </button>
        <div className="flex-1" />
        <button
          onClick={async () => {
            const ok = await confirm({
              title: `Eliminar "${name}"`,
              message: "Se borra la automatización y su historial de ejecuciones.",
              confirmLabel: "Eliminar",
              danger: true,
            });
            if (!ok) return;
            start(async () => {
              await deleteWorkflow(workflow.id);
              toast("Automatización eliminada.");
              router.push("/automations");
            });
          }}
          className="text-[12.5px] text-ink-350 hover:text-[#FF8F7A]"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function Badge({ n, label, optional }: { n: number; label: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-gold text-[11px] font-bold text-ink-950">
        {n}
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{label}</span>
      {optional && <span className="text-[11px] text-ink-450">opcional</span>}
    </div>
  );
}

function NumBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-925 px-2.5 py-1.5">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="tnum w-[56px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
      />
      <span className="text-[11px] text-ink-400">{label}</span>
    </label>
  );
}
