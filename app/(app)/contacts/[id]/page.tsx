import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/Timeline";
import AddActivity from "@/components/AddActivity";
import ContactForm from "@/components/ContactForm";
import EditToggle from "@/components/EditToggle";
import { STATUS, STAGES, GOLD, type ContactStatus } from "@/lib/constants";
import { eur, initials, shortDate } from "@/lib/format";
import type { Activity, Contact, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();

  const [{ data: contactData }, { data: dealsData }, { data: activitiesData }, { data: companies }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*, company:companies(id,name,industry)")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("deals")
        .select("*, company:companies(id,name)")
        .eq("contact_id", params.id)
        .order("value", { ascending: false }),
      supabase
        .from("activities")
        .select("*")
        .eq("contact_id", params.id)
        .order("occurred_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);

  const contact = contactData as Contact | null;
  if (!contact) notFound();

  const deals = (dealsData ?? []) as Deal[];
  const activities = (activitiesData ?? []) as Activity[];
  const openDeals = deals.filter((d) => d.stage < 5);
  const wonDeals = deals.filter((d) => d.stage === 5);
  const totalValue = deals.reduce((a, d) => a + Number(d.value), 0);
  const badge = STATUS[contact.status as ContactStatus] ?? STATUS.lead;
  const editing = searchParams.edit === "1";

  const stats = [
    { label: "Valor cliente", value: eur(totalValue), color: GOLD },
    { label: "Deals ganados", value: String(wonDeals.length), color: "#F5F5F5" },
    { label: "Actividades", value: String(activities.length), color: "#F5F5F5" },
    {
      label: "Contacto desde",
      value: new Date(contact.created_at).toLocaleDateString("es-ES", {
        month: "short",
        year: "numeric",
      }),
      color: "#F5F5F5",
    },
  ];

  const fields = [
    { label: "Email", value: contact.email || "—" },
    { label: "Teléfono", value: contact.phone || "—" },
    {
      label: "Empresa",
      value: contact.company
        ? `${contact.company.name}${contact.company.industry ? ` · ${contact.company.industry}` : ""}`
        : "—",
    },
    { label: "Cargo", value: contact.role || "—" },
    { label: "Origen", value: contact.source || "—" },
    { label: "Zona horaria", value: contact.timezone || "—" },
  ];

  return (
    <>
      <PageHeader crumb="Contactos" title={contact.name} />

      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <Link
          href="/contacts"
          className="mb-[18px] inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Todos los contactos
        </Link>

        <div className="grid grid-cols-[1.7fr_1fr] items-start gap-4">
          <div className="flex flex-col gap-4">
            {editing ? (
              <div className="panel p-[26px]">
                <div className="mb-5 text-[15px] font-semibold tracking-[-0.01em]">
                  Editar contacto
                </div>
                <ContactForm
                  companies={companies ?? []}
                  contact={contact}
                />
              </div>
            ) : (
              <div className="panel px-[26px] pb-[22px] pt-[26px]">
                <div className="flex items-center gap-[18px]">
                  <div className="grid h-[58px] w-[58px] flex-[0_0_58px] place-items-center rounded-full border border-[rgba(250,197,28,0.35)] bg-ink-800 text-[18px] font-semibold text-gold">
                    {initials(contact.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[11px]">
                      <h2 className="m-0 truncate text-[21px] font-semibold tracking-[-0.02em]">
                        {contact.name}
                      </h2>
                      <span
                        className="rounded-full px-[11px] py-1 text-[11px] font-semibold"
                        style={{
                          background: badge.bg,
                          color: badge.fg,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-[5px] text-[13px] text-ink-300">
                      {contact.role || "Sin cargo"} · {contact.company?.name || "Sin empresa"}
                    </div>
                  </div>
                  <div className="flex gap-[9px]">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-[15px] py-[9px] text-[12.5px] text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-ink-50"
                      >
                        Email
                      </a>
                    )}
                    <EditToggle />
                    <Link
                      href={`/deals/new?contact=${contact.id}`}
                      className="rounded-[9px] bg-gold px-[15px] py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
                    >
                      Nuevo deal
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-[11px] bg-hair">
                  {stats.map((s) => (
                    <div key={s.label} className="bg-ink-880 px-4 py-[15px]">
                      <div className="text-[10.5px] uppercase tracking-[0.09em] text-ink-350">
                        {s.label}
                      </div>
                      <div
                        className="tnum mt-1.5 text-[17px] font-semibold tracking-[-0.02em]"
                        style={{ color: s.color }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Timeline activities={activities} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="panel px-[22px] pb-2.5 pt-[22px]">
              <div className="text-[14px] font-semibold">Datos</div>
              <div className="mt-2">
                {fields.map((f) => (
                  <div
                    key={f.label}
                    className="hair-t flex justify-between gap-3.5 py-[11px] text-[12.5px]"
                  >
                    <span className="text-ink-350">{f.label}</span>
                    <span className="text-right text-ink-100">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel px-[22px] pb-4 pt-[22px]">
              <div className="flex items-baseline justify-between">
                <div className="text-[14px] font-semibold">Deals abiertos</div>
                <span className="tnum text-[12px] text-ink-400">{openDeals.length}</span>
              </div>
              <div className="mt-3.5 flex flex-col gap-2.5">
                {openDeals.length === 0 && (
                  <div className="text-[12.5px] text-ink-400">Ningún deal abierto.</div>
                )}
                {openDeals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="rounded-[10px] border border-hair bg-ink-800 p-[13px] text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.45)] hover:text-ink-50"
                  >
                    <div className="flex justify-between gap-2.5">
                      <span className="text-[12.5px] font-semibold">{d.name}</span>
                      <span className="tnum text-[12.5px] font-semibold text-gold">
                        {eur(Number(d.value))}
                      </span>
                    </div>
                    <div className="mt-[5px] text-[11px] text-ink-350">
                      {STAGES[d.stage]} · cierre {shortDate(d.close_date)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <AddActivity contactId={contact.id} />
          </div>
        </div>
      </div>
    </>
  );
}
