/**
 * Direcciones de las fichas.
 *
 * Sin servidor no hay quien resuelva `/contacts/<id>`: la aplicación compilada
 * son ficheros, y no existe un fichero por cada contacto. Así que la ficha es
 * una única pantalla, `/contacts/detail`, y el registro viaja en la consulta.
 * Estas funciones existen para que ese detalle esté en un solo sitio.
 */

/**
 * Los ids pueden faltar (una actividad sin contacto, por ejemplo). Las
 * entradas de menú que los usan ya vienen desactivadas en ese caso, así que
 * el tipo lo admite en vez de obligar a comprobarlo dos veces.
 */
type Id = string | null | undefined;

export const contactHref = (id: Id) => `/contacts/detail?id=${id}`;
export const companyHref = (id: Id) => `/companies/detail?id=${id}`;
export const dealHref = (id: Id) => `/deals/detail?id=${id}`;
export const formHref = (id: Id) => `/forms/detail?id=${id}`;
export const workflowHref = (id: Id) => `/automations/detail?id=${id}`;
export const inviteHref = (token: Id) => `/invite?token=${token}`;
