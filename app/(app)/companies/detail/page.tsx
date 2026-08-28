"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import NotFound from "@/components/NotFound";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData } from "@/components/SessionGate";
import CompanyForm from "@/components/CompanyForm";
import EditToggle from "@/components/EditToggle";
import Timeline from "@/components/Timeline";
import { GOLD, STAGES, STATUS, type ContactStatus } from "@/lib/constants";
import { eur, initials, relative, shortDate } from "@/lib/format";
import type { Activity, Company, Contact, Deal } from "@/lib/types";
import { contactHref, dealHref } from "@/lib/routes";

export default function CompanyDetailPage() {
  return (
    <QueryBoundary>
      <CompanyDetail />
    </QueryBoundary>
  );
}

function CompanyDetail() {
  const q = useQuery();
  const id = q.get("id") ?? "";

  const { data: loaded } = useData(async ({ supabase }) => {
    const [{ data: companyData }, { data: contactsData }, { data: dealsData }] =
      await Promise.all([
        supabase.from("companies").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", id)
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("deals")
          .select("*, contact:contacts(id,name)")
          .eq("company_id", id)
          .is("deleted_at", null)
          .order("value", { ascending: false }),
      ]);

    const contacts = (contactsData ?? []) as Contact[];
    const deals = (dealsData ?? []) as Deal[];
    const dealIds = deals.map((d) => d.id);
    const contactIds = contacts.map((c) => c.id);

    let activities: Activity[] = [];
    if (dealIds.length || contactIds.length) {
      const filters = [
        dealIds.length ? `deal_id.in.(${dealIds.join(",")})` : null,
        contactIds.length ? `contact_id.in.(${contactIds.join(",")})` : null,
      ].filter(Boolean);
      const { data } = await supabase
        .from("activities")
        .select("*")
        .or(filters.join(","))
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(60);
      activities = (data ?? []) as Activity[];
    }

    return { company: companyData as Company | null, contacts, deals, activities };
  }, [id]);

  if (!loaded) return <PageSkeleton />;

  const { company, contacts, deals, activities } = loaded;
  if (!company) return <NotFound what="La empresa" back="/companies" backLabel="Ver empresas" />;

  const open = deals.filter((d) => d.stage < 5);
  const won = deals.filter((d) => d.stage === 5);
  const lost = deals.filter((d) => d.stage === 6);
  const editing = q.get("edit") === "1";

  const stats = [
    { label: "En pipeline", value: eur(open.reduce((a, d) => a + Number(d.value), 0)), color: GOLD },
    { label: "Ganado", value: eur(won.reduce((a, d) => a + Number(d.value), 0)), color: "#F5F5F5" },
    { label: "Contactos", value: String(contacts.length), color: "#F5F5F5" },
    { label: "Deals", value: `${deals.length}`, color: "#F5F5F5" },
  ];

  const fields = [
    { label: "Sector", value: company.industry || "—" },
    { label: "Web", value: company.website || "—" },
    { label: "País", value: company.country || "—" },
    { label: "Tamaño", value: company.size ? `${company.size} empleados` : "—" },
    { label: "Deals perdidos", value: String(lost.length) },
    { label: "Alta", value: relative(company.created_at) },
  ];

  return (
    <>
      <PageHeader crumb="Empresas" title={company.name} />

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <Link
          href="/companies"
          className="mb-[18px] inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Todas las empresas
        </Link>

        {editing ? (
          <div className="panel max-w-[640px] p-7">
            <div className="mb-5 text-[15px] font-semibold tracking-[-0.01em]">
              Editar empresa
            </div>
            <CompanyForm company={company} />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="panel px-[26px] pb-[22px] pt-[26px]">
                <div className="flex flex-wrap items-center gap-[18px]">
                  <div className="grid h-[58px] w-[58px] flex-[0_0_58px] place-items-center rounded-[14px] border border-[rgba(250,197,28,0.35)] bg-ink-800 text-[18px] font-semibold text-gold">
                    {initials(company.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-[21px] font-semibold tracking-[-0.02em]">
                      {company.name}
                    </h2>
                    <div className="mt-[5px] text-[13px] text-ink-300">
                      {[company.industry, company.country].filter(Boolean).join(" · ") ||
                        "Sin sector"}
                    </div>
                  </div>
                  <div className="flex gap-[9px]">
                    <EditToggle />
                    <Link
                      href={`/deals/new?company=${company.id}`}
                      className="rounded-[9px] bg-gold px-[15px] py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
                    >
                      Nuevo deal
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-px lg:grid-cols-4 overflow-hidden rounded-[11px] bg-hair">
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

                {company.notes && (
                  <div className="mt-5 rounded-[10px] border border-hair bg-ink-925 px-3.5 py-3 text-[12.5px] leading-[1.6] text-ink-250">
                    {company.notes}
                  </div>
                )}
              </div>

              <div className="panel px-5 pb-3 pt-[20px]">
                <div className="flex items-baseline justify-between">
                  <div className="text-[14px] font-semibold">Deals de la cuenta</div>
                  <span className="tnum text-[12px] text-ink-400">{deals.length}</span>
                </div>
                <div className="mt-2">
                  {deals.length === 0 && (
                    <div className="py-6 text-[12.5px] text-ink-400">
                      Sin deals todavía.{" "}
                      <Link href={`/deals/new?company=${company.id}`} className="text-gold">
                        Crear el primero
                      </Link>
                    </div>
                  )}
                  {deals.map((d) => (
                    <Link
                      key={d.id}
                      href={dealHref(d.id)}
                      className="hair-t flex items-center gap-3 py-2.5 text-ink-50 hover:text-ink-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {d.name}
                      </span>
                      <span className="text-[11.5px] text-ink-400">{STAGES[d.stage]}</span>
                      <span className="text-[11.5px] text-ink-350">
                        {shortDate(d.close_date)}
                      </span>
                      <span className="tnum w-[86px] text-right text-[13px] font-semibold text-gold">
                        {eur(Number(d.value))}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

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
                      <span className="truncate text-right text-ink-100">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel px-[22px] pb-4 pt-[22px]">
                <div className="flex items-baseline justify-between">
                  <div className="text-[14px] font-semibold">Contactos</div>
                  <Link
                    href={`/contacts/new?company=${company.id}`}
                    className="text-[11.5px]"
                  >
                    + Añadir
                  </Link>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {contacts.length === 0 && (
                    <div className="text-[12.5px] text-ink-400">
                      Ningún contacto en esta cuenta.
                    </div>
                  )}
                  {contacts.map((c) => {
                    const b = STATUS[c.status as ContactStatus] ?? STATUS.lead;
                    return (
                      <Link
                        key={c.id}
                        href={contactHref(c.id)}
                        className="flex items-center gap-3 rounded-[10px] border border-hair bg-ink-800 p-2.5 text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.45)] hover:text-ink-50"
                      >
                        <span className="grid h-[26px] w-[26px] place-items-center rounded-full border border-hair bg-ink-900 text-[10px] font-semibold text-ink-150">
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">
                            {c.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-400">
                            {c.role || c.email || "—"}
                          </span>
                        </span>
                        <span
                          className="rounded-full px-2 py-[2px] text-[10px] font-semibold"
                          style={{
                            background: b.bg,
                            color: b.fg,
                            border: `1px solid ${b.border}`,
                          }}
                        >
                          {b.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
