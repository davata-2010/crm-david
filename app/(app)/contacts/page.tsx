import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import { STATUS, type ContactStatus, GOLD } from "@/lib/constants";
import { eur, initials, relative } from "@/lib/format";
import type { Activity, Contact, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

type Search = { q?: string; filter?: string; sort?: string; dir?: string };

const COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "Contacto" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Estado" },
  { key: "value", label: "Valor" },
  { key: "last", label: "Última actividad" },
];

export default async function ContactsPage({ searchParams }: { searchParams: Search }) {
  const supabase = createClient();
  const q = (searchParams.q || "").trim().toLowerCase();
  const filter = searchParams.filter || "all";
  const sortKey = searchParams.sort || "value";
  const dir = searchParams.dir === "asc" ? 1 : -1;

  const [{ data: contactsData }, { data: dealsData }, { data: activitiesData }] =
    await Promise.all([
      supabase.from("contacts").select("*, company:companies(id,name,industry)"),
      supabase.from("deals").select("id, contact_id, value, stage"),
      supabase.from("activities").select("id, contact_id, occurred_at"),
    ]);

  const contacts = (contactsData ?? []) as Contact[];
  const deals = (dealsData ?? []) as Deal[];
  const activities = (activitiesData ?? []) as Activity[];

  const valueByContact = new Map<string, number>();
  deals.forEach((d) => {
    if (!d.contact_id || d.stage === 5) return;
    valueByContact.set(d.contact_id, (valueByContact.get(d.contact_id) ?? 0) + Number(d.value));
  });
  const lastByContact = new Map<string, string>();
  activities.forEach((a) => {
    if (!a.contact_id) return;
    if (new Date(a.occurred_at).getTime() > Date.now()) return;
    const cur = lastByContact.get(a.contact_id);
    if (!cur || a.occurred_at > cur) lastByContact.set(a.contact_id, a.occurred_at);
  });

  const counts = {
    all: contacts.length,
    lead: contacts.filter((c) => c.status === "lead").length,
    prospect: contacts.filter((c) => c.status === "prospect").length,
    customer: contacts.filter((c) => c.status === "customer").length,
  };

  let rows = contacts
    .filter((c) => filter === "all" || c.status === filter)
    .filter(
      (c) =>
        !q ||
        `${c.name}${c.email ?? ""}${c.company?.name ?? ""}`.toLowerCase().includes(q)
    )
    .map((c) => ({
      c,
      value: valueByContact.get(c.id) ?? 0,
      lastIso: lastByContact.get(c.id) ?? c.created_at,
    }));

  rows = rows.sort((a, b) => {
    switch (sortKey) {
      case "value":
        return (a.value - b.value) * dir;
      case "company":
        return (a.c.company?.name ?? "").localeCompare(b.c.company?.name ?? "") * dir;
      case "status":
        return a.c.status.localeCompare(b.c.status) * dir;
      case "last":
        return (+new Date(a.lastIso) - +new Date(b.lastIso)) * dir;
      default:
        return a.c.name.localeCompare(b.c.name) * dir;
    }
  });

  const href = (patch: Search) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/contacts?${s}` : "/contacts";
  };

  const FILTERS: [string, string, number][] = [
    ["all", "Todos", counts.all],
    ["lead", "Leads", counts.lead],
    ["prospect", "Prospects", counts.prospect],
    ["customer", "Customers", counts.customer],
  ];

  return (
    <>
      <PageHeader
        crumb="CRM"
        title="Contactos"
        action={
          <Link
            href="/contacts/new"
            className="rounded-[9px] bg-gold px-4 py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
          >
            + Contacto
          </Link>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-9 pb-12 pt-8">
        <div className="flex flex-wrap items-center gap-2.5">
          {FILTERS.map(([key, label, count]) => {
            const active = filter === key;
            return (
              <Link
                key={key}
                href={href({ filter: key === "all" ? undefined : key })}
                className="rounded-full px-[15px] py-2 text-[12.5px] font-medium transition-colors"
                style={{
                  background: active ? GOLD : "#111111",
                  color: active ? "#080808" : "#B4B4B4",
                  border: `1px solid ${active ? GOLD : "rgba(245,245,245,0.1)"}`,
                }}
              >
                {label}{" "}
                <span className="tnum ml-[3px] opacity-65">{count}</span>
              </Link>
            );
          })}
          <div className="flex-1" />
          <div className="text-[12px] text-ink-400">{rows.length} resultados</div>
        </div>

        <div className="panel mt-[18px] overflow-hidden">
          <div className="grid grid-cols-[2.1fr_1.6fr_1fr_1fr_1.1fr_40px] items-center border-b border-hair bg-ink-915 px-5">
            {COLUMNS.map((col) => {
              const active = sortKey === col.key;
              const nextDir = active && searchParams.dir !== "asc" ? "asc" : "desc";
              return (
                <Link
                  key={col.key}
                  href={href({ sort: col.key, dir: nextDir })}
                  className="flex items-center gap-1.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors hover:text-gold"
                  style={{ color: active ? GOLD : "#7A7A7A" }}
                >
                  <span>{col.label}</span>
                  <span className="text-[9px] text-gold">
                    {active ? (searchParams.dir === "asc" ? "▲" : "▼") : ""}
                  </span>
                </Link>
              );
            })}
            <span />
          </div>

          {rows.length === 0 && (
            <div className="px-5 py-10 text-center text-[12.5px] text-ink-400">
              No hay contactos que coincidan.
            </div>
          )}

          {rows.map(({ c, value, lastIso }) => {
            const b = STATUS[c.status as ContactStatus] ?? STATUS.lead;
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="grid grid-cols-[2.1fr_1.6fr_1fr_1fr_1.1fr_40px] items-center border-b border-[rgba(245,245,245,0.05)] px-5 py-[13px] text-ink-50 transition-colors hover:bg-ink-860 hover:text-ink-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-8 w-8 flex-[0_0_32px] place-items-center rounded-full border border-[rgba(245,245,245,0.08)] bg-ink-800 text-[11.5px] font-semibold text-ink-150">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{c.name}</div>
                    <div className="truncate text-[11.5px] text-ink-400">{c.email}</div>
                  </div>
                </div>
                <div className="truncate text-[13px] text-ink-150">
                  {c.company?.name || "—"}
                </div>
                <div>
                  <span
                    className="inline-block rounded-full px-[11px] py-1 text-[11px] font-semibold"
                    style={{ background: b.bg, color: b.fg, border: `1px solid ${b.border}` }}
                  >
                    {b.label}
                  </span>
                </div>
                <div className="tnum text-[13px] font-medium">{eur(value)}</div>
                <div className="text-[12.5px] text-ink-350">{relative(lastIso)}</div>
                <div className="text-right text-[14px] text-ink-500">›</div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
