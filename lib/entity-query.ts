import { ENTITY_SOURCE, sqlColumn, type Condition, type EntityKey, type ViewConfig } from "./fields";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Traduce una condición del constructor de filtros a PostgREST. */
function applyCondition(query: any, c: Condition) {
  const col = sqlColumn(c.field);
  const v = c.value;
  const isArrayField = c.field === "tags";

  switch (c.op) {
    case "contains":
      return query.ilike(col, `%${v}%`);
    case "notContains":
      return query.not(col, "ilike", `%${v}%`);
    case "is":
      return query.eq(col, v);
    case "isNot":
      return query.neq(col, v);
    case "isEmpty":
      return isArrayField ? query.eq(col, "{}") : query.or(`${col}.is.null,${col}.eq.`);
    case "isNotEmpty":
      return isArrayField ? query.neq(col, "{}") : query.not(col, "is", null).neq(col, "");
    case "gt":
      return query.gt(col, v);
    case "gte":
      return query.gte(col, v);
    case "lt":
    case "before":
      return query.lt(col, v);
    case "lte":
      return query.lte(col, v);
    case "after":
      return query.gt(col, v);
    case "hasAny":
      return query.overlaps(col, [v]);
    default:
      return query;
  }
}

/**
 * Construye la consulta de una vista: filtros, búsqueda, orden y rango.
 *
 * Agrupar y las vistas que no son tabla necesitan el conjunto entero, no una
 * página, para que los totales por grupo y las columnas del kanban sean reales.
 */
export async function queryEntity(
  supabase: any,
  entity: EntityKey,
  cfg: ViewConfig,
  defaultSort: { field: string; dir: "asc" | "desc" }
) {
  const source = ENTITY_SOURCE[entity];
  const wholeSet = cfg.view !== "grid" || !!cfg.groupBy;
  const limit = wholeSet ? 1000 : cfg.per;

  let query = supabase.from(source.view).select("*", { count: "exact" }).is("deleted_at", null);

  for (const c of cfg.filters) query = applyCondition(query, c);

  if (cfg.q) {
    const like = `%${cfg.q}%`;
    query = query.or(source.search.map((col) => `${col}.ilike.${like}`).join(","));
  }

  const sorts = cfg.sorts.length ? cfg.sorts : [defaultSort];
  for (const s of sorts) {
    query = query.order(sqlColumn(s.field), { ascending: s.dir === "asc", nullsFirst: false });
  }

  const from = wholeSet ? 0 : cfg.page * cfg.per;
  const { data, count } = await query.range(from, from + limit - 1);

  return { rows: (data ?? []) as never[], total: (count ?? 0) as number };
}
