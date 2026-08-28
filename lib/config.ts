/**
 * Direcciones públicas del CRM.
 *
 * La aplicación ya no se aloja en ningún sitio: se instala. Pero hay cuatro
 * cosas que sí tienen que atender llamadas de fuera —los formularios públicos,
 * la captación de leads, la API que ejecutan n8n y Make, y el cron que reanuda
 * las esperas— y ésas viven en Supabase Edge Functions, en el mismo proyecto
 * que ya guarda los datos. Aquí se calcula su dirección a partir de la URL de
 * Supabase, para no tener que configurar un dominio aparte.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Base de las funciones: https://<proyecto>.supabase.co/functions/v1 */
export const FUNCTIONS_BASE = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1`
  : "";

/** Lo que llaman los nodos HTTP de n8n y Make para escribir en el CRM. */
export const ACTION_URL = `${FUNCTIONS_BASE}/automation-action`;

/** Alta de leads desde una web, un anuncio o cualquier integración. */
export const LEADS_URL = `${FUNCTIONS_BASE}/leads`;

/**
 * Endpoint al que envía el formulario público.
 *
 * No hay página alojada que valga: la pasarela de Supabase devuelve todo como
 * `text/plain` con `sandbox` en su dominio compartido, así que no se pueden
 * servir páginas HTML desde una función. El formulario se entrega como código
 * (ver `lib/form-html.ts`) y es esa página, esté donde esté, la que llama aquí.
 */
export const FORM_SUBMIT_URL = `${FUNCTIONS_BASE}/form-submit`;

/** Asistente: se ejecuta en Supabase para no exponer la clave de Anthropic. */
export const AI_URL = `${FUNCTIONS_BASE}/ai`;
