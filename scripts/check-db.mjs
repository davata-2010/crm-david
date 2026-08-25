// Verifica que el esquema de supabase/schema.sql está aplicado.
// Uso: npm run db:check
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tables = ["profiles", "companies", "contacts", "deals", "activities"];

let missing = 0;
for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  // 200 = existe y RLS deja leer (vacío sin sesión); 401/403 = existe con RLS.
  const ok = res.status !== 404;
  if (!ok) missing++;
  console.log(`${ok ? "OK  " : "FALTA"}  ${t}  (HTTP ${res.status})`);
}

if (missing) {
  console.log(`\n${missing} tabla(s) sin crear. Ejecuta supabase/schema.sql en el SQL Editor.`);
  process.exit(1);
}
console.log("\nEsquema aplicado correctamente.");
