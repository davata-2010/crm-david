import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copia a las funciones de Supabase el código que comparten con la aplicación.
 *
 * Estos ficheros los usan dos mundos: la aplicación (TypeScript, con el alias
 * `@/`) y las Edge Functions (Deno, sin alias y sin poder importar fuera de su
 * carpeta). En vez de mantener dos copias que acaban divergiendo, la de Deno se
 * genera desde la original. Si alguien edita la copia a mano, el siguiente
 * `npm run edge:sync` la pisa — que es lo que se quiere.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = resolve(root, "supabase/functions/_shared");

const HEADER = `/* Generado por scripts/sync-edge-shared.mjs — no editar a mano.
   Fuente: %s */

`;

// El motor de automatizaciones sólo importa dos tipos de `./fields`, que en
// Deno no existe; se declaran aquí y el resto del fichero pasa tal cual.
const WORKFLOW_TYPES = `type Op =
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
`;

/** Cada entrada: fichero original, destino y qué reemplazar (si algo). */
const FILES = [
  {
    from: "lib/workflows.ts",
    to: "workflows.ts",
    replace: ['import type { Condition, Op } from "./fields";\n', WORKFLOW_TYPES],
  },
  { from: "lib/constants.ts", to: "constants.ts" },
  { from: "lib/format.ts", to: "format.ts" },
];

const CR = String.fromCharCode(13);

mkdirSync(shared, { recursive: true });

for (const file of FILES) {
  const original = readFileSync(resolve(root, file.from), "utf8").split(CR).join("");

  let out = original;
  if (file.replace) {
    const [needle, replacement] = file.replace;
    out = original.replace(needle, replacement);
    if (out === original) {
      console.error(`No encontré el fragmento a sustituir en ${file.from}; revisa el script.`);
      process.exit(1);
    }
  }

  const target = resolve(shared, file.to);
  writeFileSync(target, HEADER.replace("%s", file.from) + out);
  console.log(`  ${file.from} → _shared/${file.to}`);
}

console.log(`${FILES.length} ficheros copiados a las funciones.`);
