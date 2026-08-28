import { admin, html, serve } from "../_shared/http.ts";

/**
 * Página pública de un formulario de captación.
 *
 * Antes era una pantalla del CRM en `/f/<slug>`. Ahora el CRM es una
 * aplicación instalada y no puede servir páginas a nadie, así que el
 * formulario se sirve desde aquí: HTML completo, sin depender del resto de la
 * aplicación ni de ningún framework. Se llama con
 * `/functions/v1/form/<slug>`, y con `?embed=1` cuando va dentro de un iframe.
 */

type Field = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

/** Ningún texto del formulario acaba en el HTML sin pasar por aquí. */
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const page = (title: string, body: string) => `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #080808; color: #F5F5F5;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { display: flex; justify-content: center; padding: 48px 20px; }
  .wrap.embed { padding: 32px 20px; align-items: flex-start; }
  .inner { width: 100%; max-width: 440px; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .mark {
    width: 32px; height: 32px; border-radius: 9px; background: #FAC51C; color: #080808;
    display: grid; place-items: center; font-weight: 700; font-size: 14px;
  }
  .brand span { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .panel {
    background: #101010; border: 1px solid rgba(245,245,245,0.07);
    border-radius: 16px; padding: 28px;
  }
  h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
  .desc { margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #8A8A8A; }
  .fields { margin-top: 24px; display: flex; flex-direction: column; gap: 16px; }
  label {
    display: block; margin-bottom: 8px; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em; color: #A8A8A8;
  }
  label b { color: #FAC51C; font-weight: 400; }
  input, textarea, select {
    width: 100%; background: #151515; color: #F5F5F5; font: inherit; font-size: 13.5px;
    border: 1px solid rgba(245,245,245,0.09); border-radius: 10px; padding: 12px 14px;
    outline: none;
  }
  textarea { min-height: 110px; resize: vertical; line-height: 1.55; }
  input:focus, textarea:focus, select:focus { border-color: #FAC51C; }
  button {
    margin-top: 24px; width: 100%; border: 0; border-radius: 10px; cursor: pointer;
    background: #FAC51C; color: #080808; font: inherit; font-size: 13.5px;
    font-weight: 600; padding: 14px 20px;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .err {
    margin-top: 16px; border: 1px solid rgba(250,197,28,0.25);
    background: rgba(250,197,28,0.06); border-radius: 10px;
    padding: 10px 12px; font-size: 12.5px; color: #FAC51C;
  }
  .foot { margin-top: 20px; text-align: center; font-size: 10.5px; color: #5A5A5A; }
  .done { text-align: center; }
  .tick {
    margin: 0 auto; width: 48px; height: 48px; border-radius: 50%;
    background: #FAC51C; color: #080808; display: grid; place-items: center; font-size: 20px;
  }
  .done h1 { margin-top: 20px; font-size: 19px; }
</style>
</head><body>${body}</body></html>`;

const notFound = () =>
  html(
    page(
      "Formulario no disponible",
      `<div class="wrap"><div class="inner"><div class="panel">
         <h1>Formulario no disponible</h1>
         <p class="desc">Este formulario no existe o se ha desactivado. Si te han
         pasado el enlace, pídeles uno nuevo.</p>
       </div></div></div>`
    ),
    404
  );

serve(async (req) => {
  const url = new URL(req.url);
  // La ruta llega como /form/<slug>; se toma el último tramo no vacío.
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = decodeURIComponent(parts[parts.length - 1] ?? "");
  if (!slug || slug === "form") return notFound();

  const { data: form } = await admin()
    .from("forms")
    .select("name, title, description, fields, submit_label, active, slug")
    .ilike("slug", slug)
    .maybeSingle();

  if (!form || !form.active) return notFound();

  const embed = url.searchParams.get("embed") === "1";
  const fields = (form.fields ?? []) as Field[];
  const title = form.title || form.name;

  const inputs = fields
    .map((f) => {
      const req = f.required ? " required" : "";
      const label = `<label for="f_${esc(f.key)}">${esc(f.label)}${
        f.required ? ' <b>·</b>' : ""
      }</label>`;

      if (f.type === "textarea")
        return `<div>${label}<textarea id="f_${esc(f.key)}" name="${esc(f.key)}"${req}></textarea></div>`;

      if (f.type === "select") {
        const opts = (f.options ?? [])
          .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
          .join("");
        return `<div>${label}<select id="f_${esc(f.key)}" name="${esc(
          f.key
        )}"${req}><option value=""></option>${opts}</select></div>`;
      }

      const type = f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text";
      return `<div>${label}<input id="f_${esc(f.key)}" name="${esc(
        f.key
      )}" type="${type}"${req}></div>`;
    })
    .join("");

  const body = `
<div class="wrap${embed ? " embed" : ""}"><div class="inner">
  ${
    embed
      ? ""
      : '<div class="brand"><div class="mark">A</div><span>Aurum</span></div>'
  }
  <div class="panel" id="panel">
    <form id="form" novalidate>
      <h1>${esc(title)}</h1>
      ${form.description ? `<p class="desc">${esc(form.description)}</p>` : ""}
      <div class="fields">${inputs}</div>
      <div id="err"></div>
      <button type="submit" id="send">${esc(form.submit_label || "Enviar")}</button>
    </form>
    ${embed ? "" : '<p class="foot">Tus datos se guardan sólo para responderte.</p>'}
  </div>
</div></div>
<script>
  var form = document.getElementById("form");
  var send = document.getElementById("send");
  var err  = document.getElementById("err");
  var label = send.textContent;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    err.innerHTML = "";
    send.disabled = true;
    send.textContent = "Enviando\\u2026";

    var values = {};
    new FormData(form).forEach(function (v, k) { values[k] = v; });

    try {
      var res = await fetch(${JSON.stringify(url.origin + "/functions/v1/form-submit")}, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: ${JSON.stringify(form.slug)}, values: values })
      });
      var data = await res.json();

      if (!res.ok) {
        err.innerHTML = '<div class="err"></div>';
        err.firstChild.textContent = data.error || "No se pudo enviar.";
        send.disabled = false;
        send.textContent = label;
        return;
      }
      if (data.redirect) { window.location.href = data.redirect; return; }

      var panel = document.getElementById("panel");
      panel.innerHTML = '<div class="done"><div class="tick">\\u2713</div>' +
        '<h1>\\u00a1Recibido!</h1><p class="desc" id="msg"></p></div>';
      document.getElementById("msg").textContent = data.message || "\\u00a1Gracias!";
    } catch (_) {
      err.innerHTML = '<div class="err">No hay conexi\\u00f3n con el servidor.</div>';
      send.disabled = false;
      send.textContent = label;
    }
  });
</script>`;

  return html(page(title, body));
});
