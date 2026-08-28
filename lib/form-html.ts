import { FORM_SUBMIT_URL } from "./config";

/**
 * El formulario público, como HTML autónomo.
 *
 * Antes era una pantalla del CRM en `/f/<slug>`. Ahora el CRM es una
 * aplicación instalada y no puede servir páginas a nadie, y Supabase tampoco:
 * su pasarela devuelve todo como `text/plain` con `sandbox` en el dominio
 * compartido, para que nadie aloje páginas ahí. Así que el formulario se
 * entrega como código: se pega en una web, se sube a cualquier sitio o se
 * guarda como fichero y se abre.
 *
 * No depende de nada externo —ni fuentes, ni scripts, ni CSS de fuera— y habla
 * directamente con la función `form-submit`.
 */

export type FormField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

export type FormSpec = {
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  submitLabel: string;
};

/** Nada de lo que escribe el usuario entra en el HTML sin pasar por aquí. */
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const CSS = `
  .aurum-form { --oro:#FAC51C; --fondo:#080808; --panel:#101010; --campo:#151515;
    --texto:#F5F5F5; --tenue:#8A8A8A; --linea:rgba(245,245,245,0.09);
    max-width:440px; margin:0 auto; color:var(--texto);
    font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .aurum-form * { box-sizing:border-box; }
  .aurum-form .panel { background:var(--panel); border:1px solid rgba(245,245,245,0.07);
    border-radius:16px; padding:28px; }
  .aurum-form h1 { margin:0; font-size:22px; font-weight:600; letter-spacing:-0.02em; }
  .aurum-form .desc { margin:8px 0 0; font-size:13px; line-height:1.6; color:var(--tenue); }
  .aurum-form .fields { margin-top:24px; display:flex; flex-direction:column; gap:16px; }
  .aurum-form label { display:block; margin-bottom:8px; font-size:11px;
    text-transform:uppercase; letter-spacing:0.1em; color:#A8A8A8; }
  .aurum-form label b { color:var(--oro); font-weight:400; }
  .aurum-form input, .aurum-form textarea, .aurum-form select {
    width:100%; background:var(--campo); color:var(--texto); font:inherit; font-size:13.5px;
    border:1px solid var(--linea); border-radius:10px; padding:12px 14px; outline:none; }
  .aurum-form textarea { min-height:110px; resize:vertical; line-height:1.55; }
  .aurum-form input:focus, .aurum-form textarea:focus, .aurum-form select:focus {
    border-color:var(--oro); }
  .aurum-form button { margin-top:24px; width:100%; border:0; border-radius:10px;
    cursor:pointer; background:var(--oro); color:#080808; font:inherit; font-size:13.5px;
    font-weight:600; padding:14px 20px; }
  .aurum-form button:disabled { opacity:0.5; cursor:default; }
  .aurum-form .err { margin-top:16px; border:1px solid rgba(250,197,28,0.25);
    background:rgba(250,197,28,0.06); border-radius:10px; padding:10px 12px;
    font-size:12.5px; color:var(--oro); }
  .aurum-form .done { text-align:center; }
  .aurum-form .tick { margin:0 auto; width:48px; height:48px; border-radius:50%;
    background:var(--oro); color:#080808; display:grid; place-items:center; font-size:20px; }
  .aurum-form .done h1 { margin-top:20px; font-size:19px; }`;

function campos(fields: FormField[]) {
  return fields
    .map((f) => {
      const req = f.required ? " required" : "";
      const id = `af_${esc(f.key)}`;
      const label = `<label for="${id}">${esc(f.label)}${f.required ? " <b>·</b>" : ""}</label>`;

      if (f.type === "textarea")
        return `        <div>${label}<textarea id="${id}" name="${esc(f.key)}"${req}></textarea></div>`;

      if (f.type === "select") {
        const opts = (f.options ?? [])
          .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
          .join("");
        return `        <div>${label}<select id="${id}" name="${esc(
          f.key
        )}"${req}><option value=""></option>${opts}</select></div>`;
      }

      const type = f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text";
      return `        <div>${label}<input id="${id}" name="${esc(
        f.key
      )}" type="${type}"${req}></div>`;
    })
    .join("\n");
}

/** El bloque que se pega dentro de una web que ya existe. */
export function formSnippet(form: FormSpec) {
  return `<!-- Formulario de Aurum: ${esc(form.title)} -->
<style>${CSS}
</style>

<div class="aurum-form">
  <div class="panel" id="aurum-panel">
    <form id="aurum-form" novalidate>
      <h1>${esc(form.title)}</h1>
${form.description ? `      <p class="desc">${esc(form.description)}</p>\n` : ""}      <div class="fields">
${campos(form.fields)}
      </div>
      <div id="aurum-err"></div>
      <button type="submit" id="aurum-send">${esc(form.submitLabel || "Enviar")}</button>
    </form>
  </div>
</div>

<script>
(function () {
  var form  = document.getElementById("aurum-form");
  var send  = document.getElementById("aurum-send");
  var err   = document.getElementById("aurum-err");
  var panel = document.getElementById("aurum-panel");
  var label = send.textContent;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    err.innerHTML = "";
    send.disabled = true;
    send.textContent = "Enviando\\u2026";

    var values = {};
    new FormData(form).forEach(function (v, k) { values[k] = v; });

    fetch(${JSON.stringify(FORM_SUBMIT_URL)}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: ${JSON.stringify(form.slug)}, values: values })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          var box = document.createElement("div");
          box.className = "err";
          box.textContent = res.d.error || "No se pudo enviar.";
          err.appendChild(box);
          send.disabled = false;
          send.textContent = label;
          return;
        }
        if (res.d.redirect) { window.location.href = res.d.redirect; return; }
        panel.innerHTML = '<div class="done"><div class="tick">\\u2713</div>' +
          '<h1>\\u00a1Recibido!</h1><p class="desc" id="aurum-msg"></p></div>';
        document.getElementById("aurum-msg").textContent = res.d.message || "\\u00a1Gracias!";
      })
      .catch(function () {
        var box = document.createElement("div");
        box.className = "err";
        box.textContent = "No hay conexi\\u00f3n con el servidor.";
        err.appendChild(box);
        send.disabled = false;
        send.textContent = label;
      });
  });
})();
</script>`;
}

/** La página entera, para subirla a cualquier sitio o abrirla como fichero. */
export function formPage(form: FormSpec) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(form.title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#080808; display:flex; justify-content:center;
         align-items:center; min-height:100vh; padding:48px 20px; }
</style>
</head>
<body>
${formSnippet(form)}
</body>
</html>`;
}
