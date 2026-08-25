import PageHeader from "@/components/PageHeader";
import ContactsTable, { type ContactRow } from "@/components/ContactsTable";
import NewButton from "@/components/NewButton";
import { getSession } from "@/lib/workspace";
import type { SavedView } from "@/lib/types";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  status?: string;
  company?: string;
  tag?: string;
  assigned?: string;
  sort?: string;
  dir?: string;
  page?: string;
  per?: string;
};

/** Columnas reales de la vista `contact_rows` sobre las que se puede ordenar. */
const SORTABLE: Record<string, string> = {
  name: "name",
  company: "company_name",
  status: "status",
  value: "open_value",
  deals: "open_deals",
  last: "last_activity",
  created: "created_at",
};

export default async function ContactsPage({ searchParams }: { searchParams: Search }) {
  const s = await getSession();
  const { supabase } = s;

  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "all";
  const company = searchParams.company ?? "all";
  const tag = searchParams.tag ?? "all";
  const assigned = searchParams.assigned ?? "all";
  const sortKey = SORTABLE[searchParams.sort ?? "value"] ?? "open_value";
  const ascending = searchParams.dir === "asc";
  const per = Math.min(250, Math.max(10, Number(searchParams.per) || 25));
  const page = Math.max(0, Number(searchParams.page) || 0);

  let query = supabase
    .from("contact_rows")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (status !== "all") query = query.eq("status", status);
  if (company === "none") query = query.is("company_id", null);
  else if (company !== "all") query = query.eq("company_id", company);
  if (tag !== "all") query = query.contains("tags", [tag]);
  if (assigned === "none") query = query.is("assigned_to", null);
  else if (assigned !== "all") query = query.eq("assigned_to", assigned);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `name.ilike.${like},email.ilike.${like},company_name.ilike.${like},role.ilike.${like}`
    );
  }

  const { data, count } = await query
    .order(sortKey, { ascending, nullsFirst: false })
    .range(page * per, page * per + per - 1);

  // Facetas y opciones de filtro: consultas ligeras, no la tabla entera.
  const [statusCounts, companies, tagRows, views] = await Promise.all([
    Promise.all(
      (["all", "lead", "prospect", "customer"] as const).map(async (k) => {
        let c = supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null);
        if (k !== "all") c = c.eq("status", k);
        const { count } = await c;
        return [k, count ?? 0] as const;
      })
    ),
    supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("contacts").select("tags").is("deleted_at", null).limit(2000),
    supabase
      .from("saved_views")
      .select("*")
      .eq("entity", "contacts")
      .order("created_at", { ascending: true }),
  ]);

  const allTags = Array.from(
    new Set(((tagRows.data ?? []) as { tags: string[] }[]).flatMap((r) => r.tags ?? []))
  ).sort();

  const rows = (data ?? []) as ContactRow[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Contactos"
        subtitle={`${total} en total · clic derecho para acciones rápidas`}
        action={s.canWrite ? <NewButton href="/contacts/new" label="+ Contacto" /> : null}
      />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <ContactsTable
          rows={rows}
          total={total}
          page={page}
          per={per}
          statusCounts={Object.fromEntries(statusCounts)}
          companies={companies.data ?? []}
          allTags={allTags}
          members={s.members}
          views={(views.data ?? []) as SavedView[]}
          canWrite={s.canWrite}
          currentUserId={s.userId}
        />
      </div>
    </>
  );
}
