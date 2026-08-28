import { STAGES, STATUS } from "./constants";
import { STEP_LABEL, TRIGGERS, type Step, type WorkflowRow } from "./workflows";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Traduce una automatización de Aurum a un workflow real de n8n.
 *
 * Reparto de trabajo: Aurum evalúa el disparador y las condiciones (conoce sus
 * datos) y llama al webhook; n8n orquesta los pasos y vuelve a la API de Aurum
 * para escribir. Así el workflow que aparece en n8n es funcional de verdad y se
 * puede ampliar con cualquier otro nodo.
 */

const X = 260; // separación horizontal entre nodos
const Y = 300;

type N8nNode = {
  parameters: Record<string, unknown>;
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  webhookId?: string;
};

export type N8nWorkflow = {
  id?: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main: { node: string; type: "main"; index: number }[][] }>;
  settings: Record<string, unknown>;
  pinData?: Record<string, unknown>;
};

/** Identificador estable por workflow y paso: re-sincronizar no mueve nada. */
export function stableId(seed: string) {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 2654435761) >>> 0;
    h2 = Math.imul(h2 ^ seed.charCodeAt(i), 1597334677) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  const raw = hex(h1) + hex(h2) + hex(h1 ^ h2) + hex((h1 + h2) >>> 0);
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    "4" + raw.slice(13, 16),
    "a" + raw.slice(17, 20),
    raw.slice(20, 32),
  ].join("-");
}

/** Cuerpo JSON que enviará cada nodo a la API de Aurum. */
function actionBody(step: Step, entity: "contacts" | "deals") {
  const base: Record<string, unknown> = {
    entity,
    id: "={{ $('Aurum · disparador').item.json.record.id }}",
  };

  switch (step.type) {
    case "add_tag":
    case "remove_tag":
      return { ...base, action: step.type, value: step.value };
    case "set_status":
      return { ...base, action: "set_status", value: step.value };
    case "set_stage":
      return { ...base, action: "set_stage", value: Number(step.value) };
    case "assign":
      return { ...base, action: "assign", value: step.value };
    case "create_task":
      return {
        ...base,
        action: "create_task",
        title: step.title,
        dueInDays: step.dueInDays,
        kind: step.kind,
      };
    case "add_note":
      return { ...base, action: "add_note", title: step.title, body: step.body };
    case "create_deal":
      return {
        ...base,
        action: "create_deal",
        name: step.name,
        value: step.value,
        stage: Number(step.stage),
      };
    default:
      return base;
  }
}

/** Etiqueta legible del paso, para que el lienzo de n8n se entienda solo. */
function stepLabel(step: Step, index: number) {
  const n = index + 1;
  switch (step.type) {
    case "wait": {
      const parts = [
        step.days ? `${step.days} d` : "",
        step.hours ? `${step.hours} h` : "",
        step.minutes ? `${step.minutes} min` : "",
      ].filter(Boolean);
      return `${n}. Esperar ${parts.join(" ") || "0"}`;
    }
    case "add_tag":
      return `${n}. Etiquetar «${step.value}»`;
    case "remove_tag":
      return `${n}. Quitar «${step.value}»`;
    case "set_status":
      return `${n}. Estado → ${STATUS[step.value as keyof typeof STATUS]?.label ?? step.value}`;
    case "set_stage":
      return `${n}. Etapa → ${STAGES[Number(step.value)] ?? step.value}`;
    case "assign":
      return `${n}. Asignar responsable`;
    case "create_task":
      return `${n}. Crear tarea`;
    case "add_note":
      return `${n}. Añadir nota`;
    case "create_deal":
      return `${n}. Crear deal`;
    case "webhook":
      return `${n}. Webhook externo`;
    default:
      return `${n}. ${STEP_LABEL[(step as Step).type]}`;
  }
}

export function buildN8nWorkflow(
  workflow: WorkflowRow,
  opts: { actionUrl: string; apiKey: string; webhookPath: string }
): N8nWorkflow {
  const trigger = TRIGGERS.find((t) => t.key === workflow.trigger);
  const entity = trigger?.entity ?? "contacts";

  const nodes: N8nNode[] = [];
  const connections: N8nWorkflow["connections"] = {};

  const TRIGGER_NAME = "Aurum · disparador";
  nodes.push({
    parameters: {
      httpMethod: "POST",
      path: opts.webhookPath,
      responseMode: "onReceived",
      options: {},
    },
    id: stableId(`${workflow.id}:trigger`),
    name: TRIGGER_NAME,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, Y],
    webhookId: opts.webhookPath,
  });

  let previous = TRIGGER_NAME;

  workflow.steps.forEach((step, i) => {
    const name = stepLabel(step, i);
    const position: [number, number] = [X * (i + 1), Y];
    const id = stableId(`${workflow.id}:step:${i}`);

    if (step.type === "wait") {
      const unit = step.days ? "days" : step.hours ? "hours" : "minutes";
      const amount = step.days || step.hours || step.minutes || 0;
      nodes.push({
        parameters: { amount, unit },
        id,
        name,
        type: "n8n-nodes-base.wait",
        typeVersion: 1.1,
        position,
        webhookId: stableId(`${workflow.id}:wait:${i}`),
      });
    } else if (step.type === "webhook") {
      nodes.push({
        parameters: {
          method: "POST",
          url: step.url,
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={{ JSON.stringify($('${TRIGGER_NAME}').item.json) }}`,
          options: {},
        },
        id,
        name,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position,
      });
    } else {
      const body = actionBody(step, entity);
      nodes.push({
        parameters: {
          method: "POST",
          url: opts.actionUrl,
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: "X-Api-Key", value: opts.apiKey }],
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: `={{ JSON.stringify(${JSON.stringify(body).replace(
            /"=\{\{ (.*?) \}\}"/g,
            "$1"
          )}) }}`,
          options: {},
        },
        id,
        name,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position,
      });
    }

    connections[previous] = {
      main: [[{ node: name, type: "main", index: 0 }]],
    };
    previous = name;
  });

  return {
    name: workflow.name || "Automatización de Aurum",
    nodes,
    connections,
    settings: { executionOrder: "v1" },
  };
}

/**
 * Variante para descargar a fichero.
 *
 * `import:workflow` de n8n no genera el id del workflow: lo espera dentro del
 * JSON y falla con una violación de NOT NULL si no está. La API REST, en
 * cambio, rechaza el id al crear, así que sólo se añade en el fichero.
 */
export function buildN8nExportFile(
  workflow: WorkflowRow,
  opts: { actionUrl: string; apiKey: string; webhookPath: string }
): N8nWorkflow {
  return {
    id: stableId(`${workflow.id}:workflow`).replace(/-/g, "").slice(0, 16),
    ...buildN8nWorkflow(workflow, opts),
    pinData: {},
  };
}

/* =============================================================== cliente == */

type N8nResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function call<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<N8nResult<T>> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/v1${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "X-N8N-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      // n8n devolvió HTML: casi siempre una URL mal puesta.
    }

    if (!res.ok) {
      const message =
        (parsed as { message?: string })?.message ??
        (res.status === 401
          ? "La clave de API no es válida."
          : res.status === 404
            ? "No encuentro la API de n8n en esa dirección."
            : `n8n respondió ${res.status}.`);
      return { ok: false, error: message, status: res.status };
    }

    return { ok: true, data: parsed as T };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "n8n no respondió a tiempo."
        : "No se pudo conectar con n8n. Revisa la URL y que sea accesible desde internet.";
    return { ok: false, error: message };
  }
}

/** Comprueba credenciales listando workflows. */
export async function n8nPing(baseUrl: string, apiKey: string) {
  const res = await call<{ data: unknown[] }>(baseUrl, apiKey, "/workflows?limit=1");
  if (!res.ok) return res;
  return { ok: true as const, data: { count: res.data?.data?.length ?? 0 } };
}

/** Crea o actualiza el workflow en n8n y devuelve su id y URL de webhook. */
export async function n8nSync(
  baseUrl: string,
  apiKey: string,
  body: N8nWorkflow,
  externalId: string | null
) {
  const existing = externalId
    ? await call<{ id: string }>(baseUrl, apiKey, `/workflows/${externalId}`)
    : null;

  const target = existing?.ok ? `/workflows/${externalId}` : "/workflows";
  const method = existing?.ok ? "PUT" : "POST";

  const res = await call<{ id: string; name: string }>(baseUrl, apiKey, target, {
    method,
    body: JSON.stringify(body),
  });
  if (!res.ok) return res;

  return { ok: true as const, data: res.data };
}

/**
 * Pone el workflow en marcha.
 *
 * n8n 2 renombró activar/desactivar a publicar/despublicar y dejó las rutas
 * antiguas como obsoletas; las instancias 1.x sólo tienen las antiguas. Se
 * intenta primero la nueva y se cae a la vieja sólo si no existe.
 */
export async function n8nActivate(baseUrl: string, apiKey: string, id: string, active: boolean) {
  const modern = active ? "publish" : "unpublish";
  const legacy = active ? "activate" : "deactivate";

  const res = await call<{ id: string; active: boolean }>(
    baseUrl,
    apiKey,
    `/workflows/${id}/${modern}`,
    { method: "POST" }
  );
  if (res.ok) return res;
  if (res.status !== 404) return withConflictHint(res);

  return withConflictHint(
    await call<{ id: string; active: boolean }>(baseUrl, apiKey, `/workflows/${id}/${legacy}`, {
      method: "POST",
    })
  );
}

/** El 409 al publicar casi siempre es otro workflow usando la misma ruta. */
function withConflictHint<T>(res: N8nResult<T>): N8nResult<T> {
  if (res.ok || res.status !== 409) return res;
  return {
    ok: false,
    status: res.status,
    error: `${res.error} Suele pasar cuando otro workflow de n8n ya usa esa misma ruta de webhook.`,
  };
}

/** URL de producción del webhook que Aurum llamará al dispararse. */
export function n8nWebhookUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/webhook/${path}`;
}
