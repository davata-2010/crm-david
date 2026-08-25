"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { deleteCompany } from "@/app/actions";
import { eur, eurCompact, initials } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Company } from "@/lib/types";

export type CompanyRow = {
  company: Company;
  contacts: { id: string; name: string }[];
  openValue: number;
  wonValue: number;
  openDeals: number;
  totalDeals: number;
};

type SortKey = "value" | "name" | "contacts" | "deals";

export default function CompaniesList({ rows }: { rows: CompanyRow[] }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("value");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        !t ||
        `${r.company.name} ${r.company.industry ?? ""} ${r.company.country ?? ""}`
          .toLowerCase()
          .includes(t)
    );
    return list.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.company.name.localeCompare(b.company.name);
        case "contacts":
          return b.contacts.length - a.contacts.length;
        case "deals":
          return b.totalDeals - a.totalDeals;
        default:
          return b.openValue + b.wonValue - (a.openValue + a.wonValue);
      }
    });
  }, [rows, q, sort]);

  function run(fn: () => Promise<{ error?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        router.refresh();
      }
    });
  }

  function menu(r: CompanyRow): MenuItem[] {
    const c = r.company;
    return [
      { kind: "label", label: c.name },
      { label: "Abrir ficha", icon: "↗", onSelect: () => router.push(`/companies/${c.id}`) },
      {
        label: "Abrir en pestaña nueva",
        icon: "⧉",
        onSelect: () => window.open(`/companies/${c.id}`, "_blank"),
      },
      { label: "Editar", icon: "✎", onSelect: () => router.push(`/companies/${c.id}?edit=1`) },
      { kind: "separator" },
      {
        label: "Abrir web",
        icon: "🌐",
        disabled: !c.website,
        onSelect: () => {
          const url = c.website!.startsWith("http") ? c.website! : `https://${c.website}`;
          window.open(url, "_blank");
        },
      },
      {
        label: "Copiar nombre",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(c.name);
          toast("Copiado.");
        },
      },
      { kind: "separator" },
      {
        label: "Nuevo contacto aquí",
        icon: "＋",
        onSelect: () => router.push(`/contacts/new?company=${c.id}`),
      },
      {
        label: "Nuevo deal aquí",
        icon: "＋",
        onSelect: () => router.push(`/deals/new?company=${c.id}`),
      },
      {
        label: "Ver contactos",
        icon: "◍",
        disabled: r.contacts.length === 0,
        onSelect: () => router.push(`/companies/${c.id}`),
      },
      { kind: "separator" },
      {
        label: "Eliminar empresa",
        icon: "✕",
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `Eliminar ${c.name}`,
            message: `Sus ${r.contacts.length} contactos y ${r.totalDeals} deals se conservan, pero quedarán sin empresa asignada.`,
            confirmLabel: "Eliminar",
            danger: true,
          });
          if (ok) run(() => deleteCompany(c.id), "Empresa eliminada.");
        },
      },
    ];
  }

  const bgMenu: MenuItem[] = [
    { kind: "label", label: "Empresas" },
    { label: "Nueva empresa", icon: "＋", onSelect: () => router.push("/companies/new") },
    {
      label: "Exportar a CSV",
      icon: "↓",
      onSelect: () => {
        downloadCsv(
          "empresas.csv",
          toCsv(
            filtered.map((r) => ({
              nombre: r.company.name,
              sector: r.company.industry ?? "",
              web: r.company.website ?? "",
              pais: r.company.country ?? "",
              tamano: r.company.size ?? "",
              contactos: r.contacts.length,
              deals_abiertos: r.openDeals,
              valor_abierto: r.openValue,
              valor_ganado: r.wonValue,
            }))
          )
        );
        toast(`${filtered.length} empresas exportadas.`);
      },
    },
  ];

  return (
    <div onContextMenu={(e) => openMenu(e, bgMenu)}>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-3 py-2">
          <span className="text-[12px] text-ink-450">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa…"
            className="w-[190px] border-none bg-transparent text-[12.5px] text-ink-50 outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-2.5 py-2 text-[12.5px] text-ink-150 outline-none"
        >
          <option value="value">Por valor</option>
          <option value="name">Por nombre</option>
          <option value="contacts">Por nº de contactos</option>
          <option value="deals">Por nº de deals</option>
        </select>
        <div className="flex-1" />
        <div className="text-[12px] text-ink-400">{filtered.length} empresas</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="panel col-span-2 px-6 py-12 text-center text-[12.5px] text-ink-400">
            No hay empresas.{" "}
            <Link href="/companies/new" className="text-gold">
              Crear la primera
            </Link>
          </div>
        )}

        {filtered.map((r) => {
          const c = r.company;
          return (
            <div
              key={c.id}
              onContextMenu={(e) => openMenu(e, menu(r))}
              onClick={() => router.push(`/companies/${c.id}`)}
              className="panel cursor-pointer px-5 py-[18px] transition-colors hover:border-[rgba(250,197,28,0.28)]"
            >
              <div className="flex items-center gap-3.5">
                <div className="grid h-[38px] w-[38px] flex-[0_0_38px] place-items-center rounded-[10px] bg-ink-800 text-[12px] font-semibold text-gold">
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                    {c.name}
                  </div>
                  <div className="mt-[3px] truncate text-[11.5px] text-ink-350">
                    {[c.industry, c.country, c.website].filter(Boolean).join(" · ") ||
                      "Sin datos"}
                  </div>
                </div>
                <div className="tnum text-right">
                  <div className="text-[13.5px] font-semibold text-gold">
                    {eurCompact(r.openValue)}
                  </div>
                  <div className="mt-[2px] text-[11px] text-ink-400">
                    {r.openDeals} abiertos
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(e, menu(r));
                  }}
                  className="text-[15px] text-ink-500 transition-colors hover:text-gold"
                >
                  ⋯
                </button>
              </div>

              <div className="mt-3.5 flex items-center gap-4 border-t border-[rgba(245,245,245,0.06)] pt-3 text-[11px] text-ink-400">
                <span>{r.contacts.length} contactos</span>
                <span>{r.totalDeals} deals</span>
                {r.wonValue > 0 && (
                  <span className="text-gold">{eur(r.wonValue)} ganados</span>
                )}
                <div className="flex-1" />
                {r.contacts.slice(0, 4).map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className="grid h-[20px] w-[20px] place-items-center rounded-full border border-hair bg-ink-800 text-[9px] font-semibold text-ink-150"
                  >
                    {initials(p.name)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
