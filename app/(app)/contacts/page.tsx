import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import ContactsTable, { type ContactRow } from "@/components/ContactsTable";
import NewButton from "@/components/NewButton";
import type { Activity, Contact, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = createClient();

  const [{ data: contactsData }, { data: dealsData }, { data: activitiesData }, { data: companies }] =
    await Promise.all([
      supabase.from("contacts").select("*, company:companies(id,name,industry)"),
      supabase.from("deals").select("id, contact_id, value, stage"),
      supabase.from("activities").select("id, contact_id, occurred_at, due_date, completed"),
      supabase.from("companies").select("id, name").order("name"),
    ]);

  const contacts = (contactsData ?? []) as Contact[];
  const deals = (dealsData ?? []) as Deal[];
  const activities = (activitiesData ?? []) as Activity[];

  const valueByContact = new Map<string, number>();
  const dealsByContact = new Map<string, number>();
  deals.forEach((d) => {
    if (!d.contact_id || d.stage >= 5) return;
    valueByContact.set(d.contact_id, (valueByContact.get(d.contact_id) ?? 0) + Number(d.value));
    dealsByContact.set(d.contact_id, (dealsByContact.get(d.contact_id) ?? 0) + 1);
  });

  const lastByContact = new Map<string, string>();
  const tasksByContact = new Map<string, number>();
  activities.forEach((a) => {
    if (!a.contact_id) return;
    if (a.due_date && !a.completed) {
      tasksByContact.set(a.contact_id, (tasksByContact.get(a.contact_id) ?? 0) + 1);
    }
    if (new Date(a.occurred_at).getTime() > Date.now()) return;
    const cur = lastByContact.get(a.contact_id);
    if (!cur || a.occurred_at > cur) lastByContact.set(a.contact_id, a.occurred_at);
  });

  const rows: ContactRow[] = contacts.map((c) => ({
    contact: c,
    value: valueByContact.get(c.id) ?? 0,
    openDeals: dealsByContact.get(c.id) ?? 0,
    taskCount: tasksByContact.get(c.id) ?? 0,
    lastIso: lastByContact.get(c.id) ?? c.created_at,
  }));

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort();

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Contactos"
        subtitle={`${contacts.length} en total · clic derecho para acciones rápidas`}
        action={<NewButton href="/contacts/new" label="+ Contacto" />}
      />
      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <ContactsTable rows={rows} companies={companies ?? []} allTags={allTags} />
      </div>
    </>
  );
}
