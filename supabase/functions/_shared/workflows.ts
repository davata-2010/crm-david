/* Generado por scripts/sync-edge-shared.mjs — no editar a mano.
   Fuente: lib/workflows.ts */

type Op =
  | "is"
  | "isNot"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "hasAny"
  | "before"
  | "after";

type Condition = { field: string; op: Op; value: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

/* =============================================================== tipos == */

export type TriggerKey =
  | "contact.created"
  | "contact.tag_added"
  | "contact.status_changed"
  | "deal.created"
  | "deal.stage_changed"
  | "form.submitted";

export const TRIGGERS: {
  key: TriggerKey;
  label: string;
  entity: "contacts" | "deals";
  hint: string;
  config?: "tag" | "status" | "stage" | "form";
}[] = [
  {
    key: "contact.created",
    label: "Se crea un contacto",
    entity: "contacts",
    hint: "Alta manual, importación CSV, API o formulario",
  },
  {
    key: "contact.tag_added",
    label: "Se añade una etiqueta a un contacto",
    entity: "contacts",
    hint: "Se dispara sólo con la etiqueta que elijas",
    config: "tag",
  },
  {
    key: "contact.status_changed",
    label: "Cambia el estado de un contacto",
    entity: "contacts",
    hint: "Por ejemplo, al pasar a Customer",
    config: "status",
  },
  { key: "deal.created", label: "Se crea un deal", entity: "deals", hint: "Cualquier alta de deal" },
  {
    key: "deal.stage_changed",
    label: "Un deal cambia de etapa",
    entity: "deals",
    hint: "El clásico: al llegar a Propuesta, haz X",
    config: "stage",
  },
  {
    key: "form.submitted",
    label: "Se envía un formulario",
    entity: "contacts",
    hint: "El contacto que crea el formulario entra aquí",
    config: "form",
  },
];

export type Step =
  | { type: "wait"; days?: number; hours?: number; minutes?: number }
  | { type: "add_tag"; value: string }
  | { type: "remove_tag"; value: string }
  | { type: "set_status"; value: string }
  | { type: "set_stage"; value: string }
  | { type: "assign"; value: string }
  | { type: "create_task"; title: string; dueInDays: number; kind: string }
  | { type: "add_note"; title: string; body: string }
  | { type: "create_deal"; name: string; value: number; stage: string }
  | { type: "webhook"; url: string };

export const STEP_LABEL: Record<Step["type"], string> = {
  wait: "Esperar",
  add_tag: "Añadir etiqueta",
  remove_tag: "Quitar etiqueta",
  set_status: "Cambiar estado",
  set_stage: "Mover de etapa",
  assign: "Asignar responsable",
  create_task: "Crear tarea",
  add_note: "Añadir nota",
  create_deal: "Crear deal",
  webhook: "Llamar a un webhook",
};

export type WorkflowRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  trigger: TriggerKey;
  trigger_config: Record<string, string>;
  conditions: Condition[];
  steps: Step[];
  active: boolean;
  runs_count: number;
  last_run_at: string | null;
  created_at: string;
  engine: "aurum" | "n8n" | "make";
  external_id: string | null;
  external_url: string | null;
  external_name: string | null;
  external_synced_at: string | null;
  external_error: string | null;
};

export type RunRow = {
  id: string;
  workspace_id: string;
  workflow_id: string;
  entity: string;
  record_id: string | null;
  record_label: string;
  status: "running" | "waiting" | "done" | "error";
  step_index: number;
  resume_at: string | null;
  log: { at: string; step: number; action: string; detail: string }[];
  error: string | null;
  created_at: string;
  updated_at: string;
};

/* ========================================================== condiciones == */

const asText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Evalúa una condición del constructor contra el registro que disparó. */
export function matches(record: Record<string, unknown>, c: Condition): boolean {
  const raw = c.field.startsWith("custom.")
    ? ((record.custom ?? {}) as Record<string, unknown>)[c.field.slice(7)]
    : record[c.field];

  const text = asText(raw).toLowerCase();
  const value = asText(c.value).toLowerCase();
  const list = Array.isArray(raw) ? (raw as unknown[]).map((x) => asText(x).toLowerCase()) : null;
  const num = Number(raw);
  const target = Number(c.value);

  const ops: Record<Op, () => boolean> = {
    is: () => text === value,
    isNot: () => text !== value,
    contains: () => text.includes(value),
    notContains: () => !text.includes(value),
    isEmpty: () => (list ? list.length === 0 : text === ""),
    isNotEmpty: () => (list ? list.length > 0 : text !== ""),
    gt: () => num > target,
    gte: () => num >= target,
    lt: () => num < target,
    lte: () => num <= target,
    hasAny: () => (list ? list.includes(value) : text.includes(value)),
    before: () => !!raw && new Date(asText(raw)) < new Date(c.value),
    after: () => !!raw && new Date(asText(raw)) > new Date(c.value),
  };

  try {
    return ops[c.op]?.() ?? true;
  } catch {
    return false;
  }
}

/** Sustituye {{campo}} por el valor del registro. */
export function fillTemplate(text: string, record: Record<string, unknown>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const raw = key.startsWith("custom.")
      ? ((record.custom ?? {}) as Record<string, unknown>)[key.slice(7)]
      : record[key];
    return Array.isArray(raw) ? raw.join(", ") : asText(raw);
  });
}

/* ============================================================== motor === */

type Ctx = {
  supabase: any;
  workspaceId: string;
  actor: string;
};

const waitMs = (s: Extract<Step, { type: "wait" }>) =>
  ((s.days ?? 0) * 24 * 60 + (s.hours ?? 0) * 60 + (s.minutes ?? 0)) * 60_000;

/**
 * Ejecuta los pasos de una ejecución desde `from`.
 * Se detiene al llegar a una espera y deja la ejecución en `waiting`.
 */
async function runSteps(
  ctx: Ctx,
  run: { id: string; entity: string; record_id: string | null },
  steps: Step[],
  record: Record<string, unknown>,
  from: number,
  log: RunRow["log"]
) {
  const { supabase, workspaceId, actor } = ctx;

  for (let i = from; i < steps.length; i++) {
    const step = steps[i];
    const note = (action: string, detail: string) =>
      log.push({ at: new Date().toISOString(), step: i, action, detail });

    try {
      if (step.type === "wait") {
        const resumeAt = new Date(Date.now() + waitMs(step)).toISOString();
        note("wait", `Espera hasta ${resumeAt}`);
        await supabase
          .from("workflow_runs")
          .update({ status: "waiting", step_index: i + 1, resume_at: resumeAt, log })
          .eq("id", run.id);
        return;
      }

      const table = run.entity === "deals" ? "deals" : "contacts";
      const id = run.record_id;
      if (!id) throw new Error("La ejecución no tiene registro asociado.");

      switch (step.type) {
        case "add_tag":
        case "remove_tag": {
          const tag = fillTemplate(step.value, record).trim();
          const current: string[] = (record.tags as string[]) ?? [];
          const next =
            step.type === "add_tag"
              ? Array.from(new Set([...current, tag])).slice(0, 12)
              : current.filter((t) => t !== tag);
          await supabase.from(table).update({ tags: next }).eq("id", id);
          record.tags = next;
          note(step.type, tag);
          break;
        }
        case "set_status": {
          await supabase.from("contacts").update({ status: step.value }).eq("id", id);
          record.status = step.value;
          note("set_status", step.value);
          break;
        }
        case "set_stage": {
          await supabase.from("deals").update({ stage: Number(step.value) }).eq("id", id);
          record.stage = Number(step.value);
          note("set_stage", step.value);
          break;
        }
        case "assign": {
          await supabase.from(table).update({ assigned_to: step.value || null }).eq("id", id);
          note("assign", step.value || "sin asignar");
          break;
        }
        case "create_task": {
          const due = new Date(Date.now() + (step.dueInDays ?? 0) * 86_400_000).toISOString();
          await supabase.from("activities").insert({
            workspace_id: workspaceId,
            owner_id: actor,
            contact_id: run.entity === "contacts" ? id : (record.contact_id as string) ?? null,
            deal_id: run.entity === "deals" ? id : null,
            kind: step.kind || "Tarea",
            title: fillTemplate(step.title, record),
            body: "",
            author: "Automatización",
            occurred_at: new Date().toISOString(),
            due_date: due,
            completed: false,
          });
          note("create_task", fillTemplate(step.title, record));
          break;
        }
        case "add_note": {
          await supabase.from("activities").insert({
            workspace_id: workspaceId,
            owner_id: actor,
            contact_id: run.entity === "contacts" ? id : (record.contact_id as string) ?? null,
            deal_id: run.entity === "deals" ? id : null,
            kind: "Nota",
            title: fillTemplate(step.title || "Nota automática", record),
            body: fillTemplate(step.body, record),
            author: "Automatización",
            occurred_at: new Date().toISOString(),
            due_date: null,
            completed: false,
          });
          note("add_note", fillTemplate(step.title || "Nota", record));
          break;
        }
        case "create_deal": {
          await supabase.from("deals").insert({
            workspace_id: workspaceId,
            owner_id: actor,
            assigned_to: (record.assigned_to as string) ?? actor,
            contact_id: run.entity === "contacts" ? id : null,
            company_id: (record.company_id as string) ?? null,
            name: fillTemplate(step.name, record),
            value: Number(step.value) || 0,
            stage: Number(step.stage) || 0,
            project_type: "Agentes",
          });
          note("create_deal", fillTemplate(step.name, record));
          break;
        }
        case "webhook": {
          const res = await fetch(step.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entity: run.entity, record }),
            signal: AbortSignal.timeout(8000),
          });
          note("webhook", `${step.url} → ${res.status}`);
          break;
        }
      }
    } catch (err) {
      log.push({
        at: new Date().toISOString(),
        step: i,
        action: step.type,
        detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
      await supabase
        .from("workflow_runs")
        .update({
          status: "error",
          step_index: i,
          log,
          error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", run.id);
      return;
    }
  }

  await supabase
    .from("workflow_runs")
    .update({ status: "done", step_index: steps.length, resume_at: null, log })
    .eq("id", run.id);
}

/**
 * Punto de entrada: algo ha pasado en el CRM, mira qué automatizaciones
 * aplican y ejecútalas. Nunca lanza: un fallo aquí no debe tumbar la acción
 * del usuario que lo disparó.
 */
export async function fireTrigger(
  ctx: Ctx,
  trigger: TriggerKey,
  payload: {
    entity: "contacts" | "deals";
    record: Record<string, unknown>;
    tag?: string;
    status?: string;
    stage?: number;
    formId?: string;
  }
) {
  try {
    const { data: flows } = await ctx.supabase
      .from("workflows")
      .select("*")
      .eq("trigger", trigger)
      .eq("active", true);

    for (const flow of (flows ?? []) as WorkflowRow[]) {
      const cfg = flow.trigger_config ?? {};

      if (trigger === "contact.tag_added" && cfg.tag && cfg.tag !== payload.tag) continue;
      if (trigger === "contact.status_changed" && cfg.status && cfg.status !== payload.status)
        continue;
      if (trigger === "deal.stage_changed" && cfg.stage && Number(cfg.stage) !== payload.stage)
        continue;
      if (trigger === "form.submitted" && cfg.form && cfg.form !== payload.formId) continue;

      const conditions = flow.conditions ?? [];
      if (conditions.length && !conditions.every((c) => matches(payload.record, c))) continue;

      const external = flow.engine !== "aurum" && flow.external_url;

      const { data: run } = await ctx.supabase
        .from("workflow_runs")
        .insert({
          workspace_id: ctx.workspaceId,
          workflow_id: flow.id,
          entity: payload.entity,
          record_id: (payload.record.id as string) ?? null,
          record_label: String(payload.record.name ?? ""),
          status: "running",
          step_index: 0,
          log: [],
        })
        .select("id, entity, record_id")
        .single();

      if (!run) continue;

      await ctx.supabase
        .from("workflows")
        .update({ runs_count: (flow.runs_count ?? 0) + 1, last_run_at: new Date().toISOString() })
        .eq("id", flow.id);

      if (external) {
        await handOff(ctx, flow, run, payload);
      } else {
        await runSteps(ctx, run, flow.steps ?? [], { ...payload.record }, 0, []);
      }
    }
  } catch {
    // Silencio deliberado: la automatización no puede romper el CRM.
  }
}

/**
 * Entrega el disparo al motor externo (n8n o Make).
 *
 * Aurum ya ha comprobado el disparador y las condiciones; a partir de aquí
 * los pasos los ejecuta el otro motor llamando de vuelta a la API del CRM.
 */
async function handOff(
  ctx: Ctx,
  flow: WorkflowRow,
  run: { id: string },
  payload: { entity: string; record: Record<string, unknown> }
) {
  const log: RunRow["log"] = [];
  const at = new Date().toISOString();

  try {
    const res = await fetch(flow.external_url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: { id: flow.id, name: flow.name, trigger: flow.trigger },
        entity: payload.entity,
        record: payload.record,
        firedAt: at,
      }),
      signal: AbortSignal.timeout(15000),
    });

    log.push({
      at,
      step: 0,
      action: flow.engine,
      detail: `Entregado a ${flow.engine} → HTTP ${res.status}`,
    });

    await ctx.supabase
      .from("workflow_runs")
      .update({
        status: res.ok ? "done" : "error",
        log,
        error: res.ok ? null : `El motor externo respondió ${res.status}.`,
      })
      .eq("id", run.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push({ at, step: 0, action: flow.engine, detail: `Error: ${message}` });
    await ctx.supabase
      .from("workflow_runs")
      .update({ status: "error", log, error: message })
      .eq("id", run.id);
  }
}

/** Reanuda las ejecuciones cuya espera ya venció. La llama el cron. */
export async function resumeDueRuns(supabase: any, limit = 50) {
  const { data: due } = await supabase
    .from("workflow_runs")
    .select("*, workflow:workflows(*)")
    .eq("status", "waiting")
    .lte("resume_at", new Date().toISOString())
    .limit(limit);

  let resumed = 0;

  for (const run of (due ?? []) as (RunRow & { workflow: WorkflowRow })[]) {
    const flow = run.workflow;
    if (!flow || !flow.active) {
      await supabase
        .from("workflow_runs")
        .update({ status: "done", resume_at: null })
        .eq("id", run.id);
      continue;
    }

    const table = run.entity === "deals" ? "deals" : "contacts";
    const { data: record } = await supabase
      .from(table)
      .select("*")
      .eq("id", run.record_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!record) {
      await supabase
        .from("workflow_runs")
        .update({
          status: "done",
          resume_at: null,
          error: "El registro ya no existe.",
        })
        .eq("id", run.id);
      continue;
    }

    await supabase
      .from("workflow_runs")
      .update({ status: "running", resume_at: null })
      .eq("id", run.id);

    await runSteps(
      { supabase, workspaceId: run.workspace_id ?? flow.workspace_id, actor: record.owner_id },
      { id: run.id, entity: run.entity, record_id: run.record_id },
      flow.steps ?? [],
      record,
      run.step_index,
      run.log ?? []
    );
    resumed++;
  }

  return resumed;
}
