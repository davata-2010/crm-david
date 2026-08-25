/** Utilidades CSV mínimas: sin dependencias, compatibles con Excel y Sheets. */

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Parsea CSV con comillas y separador `,` o `;`. Devuelve objetos por cabecera. */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? undefined : clean.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);

  const header = rows.shift();
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());

  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, i) => (obj[k] = (r[i] ?? "").trim()));
      return obj;
    });
}

/** Mapea cabeceras habituales (es/en) a los campos de contacto. */
export function mapContactRow(r: Record<string, string>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (r[k]) return r[k];
    return "";
  };
  return {
    name: pick("nombre", "name", "contacto", "full name", "fullname"),
    email: pick("email", "correo", "e-mail", "mail"),
    phone: pick("telefono", "teléfono", "phone", "móvil", "movil"),
    role: pick("cargo", "role", "puesto", "title", "job title"),
    company: pick("empresa", "company", "cuenta", "account", "organización", "organizacion"),
    status: pick("estado", "status"),
    tags: pick("etiquetas", "tags"),
  };
}
