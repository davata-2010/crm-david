import { STAGES } from "./constants";
import { TRIGGERS, type Step, type WorkflowRow } from "./workflows";

/**
 * Genera un blueprint de Make (Integromat) a partir de una automatización.
 *
 * A diferencia de n8n, Make no permite crear escenarios por API sin un plan y
 * un equipo configurados, así que aquí producimos el fichero que se importa
 * desde «Create a new scenario → Import Blueprint». El resultado es un
 * escenario funcional: webhook de entrada y módulos HTTP que llaman de vuelta
 * a la API de Aurum, igual que en n8n.
 */

type Module = {
  id: number;
  module: string;
  version: number;
  parameters: Record<string, unknown>;
  mapper: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type MakeBlueprint = {
  name: string;
  flow: Module[];
  metadata: Record<string, unknown>;
};

const label = (step: Step, i: number) => {
  const n = i + 1;
  switch (step.type) {
    case "wait":
      return `${n}. Esperar`;
    case "add_tag":
      return `${n}. Etiquetar ${step.value}`;
    case "remove_tag":
      return `${n}. Quitar ${step.value}`;
    case "set_status":
      return `${n}. Cambiar estado`;
    case "set_stage":
      return `${n}. Etapa → ${STAGES[Number(step.value)] ?? step.value}`;
    case "assign":
      return `${n}. Asignar`;
    case "create_task":
      return `${n}. Crear tarea`;
    case "add_note":
      return `${n}. Añadir nota`;
    case "create_deal":
      return `${n}. Crear deal`;
    case "webhook":
      return `${n}. Webhook externo`;
    default:
      return `${n}. Paso`;
  }
};

function payload(step: Step, entity: "contacts" | "deals") {
  const base: Record<string, unknown> = { entity, id: "{{1.record.id}}" };
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

export function buildMakeBlueprint(
  workflow: WorkflowRow,
  opts: { crmUrl: string; apiKey: string }
): MakeBlueprint {
  const trigger = TRIGGERS.find((t) => t.key === workflow.trigger);
  const entity = trigger?.entity ?? "contacts";

  const flow: Module[] = [
    {
      id: 1,
      module: "gateway:CustomWebHook",
      version: 1,
      parameters: { hook: null, maxResults: 1 },
      mapper: {},
      metadata: {
        designer: { x: 0, y: 0, name: "Aurum · disparador" },
        restore: { parameters: { hook: { label: `Aurum — ${workflow.name}` } } },
      },
    },
  ];

  workflow.steps.forEach((step, i) => {
    const id = i + 2;
    const x = 300 * id;

    if (step.type === "wait") {
      const minutes =
        (step.days ?? 0) * 1440 + (step.hours ?? 0) * 60 + (step.minutes ?? 0);
      flow.push({
        id,
        module: "builtin:BasicSleep",
        version: 1,
        parameters: {},
        // Make limita la espera a 300 s por módulo; para esperas largas usa
        // el planificador del escenario o vuelve al motor de Aurum.
        mapper: { duration: Math.min(300, Math.max(1, minutes * 60)) },
        metadata: { designer: { x, y: 0, name: label(step, i) } },
      });
      return;
    }

    const url =
      step.type === "webhook" ? step.url : `${opts.crmUrl}/api/automation/action`;
    const body =
      step.type === "webhook"
        ? { record: "{{1.record}}" }
        : payload(step, entity);

    flow.push({
      id,
      module: "http:ActionSendData",
      version: 3,
      parameters: { handleErrors: true, useNewZLibDeCompress: true },
      mapper: {
        url,
        method: "post",
        headers:
          step.type === "webhook"
            ? []
            : [{ name: "X-Api-Key", value: opts.apiKey }],
        qs: [],
        bodyType: "raw",
        contentType: "application/json",
        data: JSON.stringify(body),
        parseResponse: true,
        timeout: 40,
        followRedirect: true,
        gzip: true,
      },
      metadata: { designer: { x, y: 0, name: label(step, i) } },
    });
  });

  return {
    name: workflow.name || "Automatización de Aurum",
    flow,
    metadata: {
      instant: true,
      version: 1,
      scenario: {
        roundtrips: 1,
        maxErrors: 3,
        autoCommit: true,
        autoCommitTriggerLast: true,
        sequential: true,
        confidential: false,
        dataloss: false,
        dlq: false,
      },
      designer: { orphans: [] },
      zone: "eu1.make.com",
    },
  };
}
