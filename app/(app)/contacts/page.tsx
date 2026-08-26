import PageHeader from "@/components/PageHeader";
import ContactsWorkspace from "@/components/grid/ContactsWorkspace";
import NewButton from "@/components/NewButton";
import { getSession } from "@/lib/workspace";
import {
  contactFields,
  parseViewConfig,
  sqlColumn,
  type Condition,
  type ViewConfig,
} from "@/lib/fields";
import type { CustomField, SavedView } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Aplica una condición del constructor de filtros a la consulta. */
function applyCondition(query: any, c: Condition) {
  const col = sqlColumn(c.field);
  const v = c.value;

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
      return c.field === "tags" ? query.eq(col, "{}") : query.or(`${col}.is.null,${col}.eq.`);
    case "isNotEmpty":
      return c.field === "tags"
        ? query.neq(col, "{}")
        : query.not(col, "is", null).neq(col, "");
    case "gt":
      return query.gt(col, v);
    case "gte":
      return query.gte(col, v);
    case "lt":
      return query.lt(col, v);
    case "lte":
      return query.lte(col, v);
    case "hasAny":
      return query.overlaps(col, [v]);
    case "before":
      return query.lt(col, v);
    case "after":
      return query.gt(col, v);
    default:
      return query;
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const s = await getSession();
  const { supabase } = s;
  const cfg: ViewConfig = parseViewConfig(searchParams);

  // Agrupar, kanban, calendario y galería necesitan el conjunto entero,
  // no una página: en esos modos se sube el techo y se quita la paginación.
  const wholeSet = cfg.view !== "grid" || !!cfg.groupBy;
  const limit = wholeSet ? 1000 : cfg.per;

  let query = supabase.from("contact_rows").select("*", { count: "exact" }).is("deleted_at", null);

  for (const c of cfg.filters) query = applyCondition(query, c);

  if (cfg.q) {
    const like = `%${cfg.q}%`;
    query = query.or(
      `name.ilike.${like},email.ilike.${like},company_name.ilike.${like},role.ilike.${like},phone.ilike.${like}`
    );
  }

  const sorts = cfg.sorts.length ? cfg.sorts : [{ field: "last_activity", dir: "desc" as const }];
  for (const srt of sorts) {
    query = query.order(sqlColumn(srt.field), {
      ascending: srt.dir === "asc",
      nullsFirst: false,
    });
  }

  const from = wholeSet ? 0 : cfg.page * cfg.per;
  const { data, count } = await query.range(from, from + limit - 1);

  const [{ data: facets }, companiesRes, viewsRes, fieldsRes] = await Promise.all([
    supabase.rpc("contact_facets"),
    supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("saved_views")
      .select("*")
      .eq("entity", "contacts")
      .order("created_at", { ascending: true }),
    supabase
      .from("custom_fields")
      .select("*")
      .eq("entity", "contacts")
      .order("position", { ascending: true }),
  ]);

  const companies = companiesRes.data ?? [];
  const custom = (fieldsRes.data ?? []) as CustomField[];
  const fields = contactFields(companies, s.members, custom);

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Contactos"
        subtitle={`${count ?? 0} registros · edita en la propia celda`}
        action={s.canWrite ? <NewButton href="/contacts/new" label="+ Contacto" /> : null}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContactsWorkspace
          rows={(data ?? []) as never[]}
          total={count ?? 0}
          config={cfg}
          fields={fields}
          companies={companies}
          members={s.members}
          tags={((facets?.tags ?? []) as string[]).filter(Boolean)}
          statusCounts={{
            all: facets?.all ?? 0,
            lead: facets?.lead ?? 0,
            prospect: facets?.prospect ?? 0,
            customer: facets?.customer ?? 0,
          }}
          views={(viewsRes.data ?? []) as SavedView[]}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
