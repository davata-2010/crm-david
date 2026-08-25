"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { GOLD, STAGES } from "@/lib/constants";
import { eur, initials } from "@/lib/format";

type Row = {
  id: string;
  kind: "contact" | "company" | "deal" | "action";
  title: string;
  sub: string;
  href: string;
  icon: string;
};

const ACTIONS: Row[] = [
  { id: "a1", kind: "action", title: "Ir al dashboard", sub: "Panel", href: "/", icon: "◫" },
  { id: "a2", kind: "action", title: "Ver pipeline", sub: "Kanban de deals", href: "/pipeline", icon: "▦" },
  { id: "a3", kind: "action", title: "Nuevo contacto", sub: "Crear", href: "/contacts/new", icon: "＋" },
  { id: "a4", kind: "action", title: "Nuevo deal", sub: "Crear", href: "/deals/new", icon: "＋" },
  { id: "a5", kind: "action", title: "Tareas pendientes", sub: "Seguimiento", href: "/tasks", icon: "✓" },
  { id: "a6", kind: "action", title: "Informes", sub: "Analítica", href: "/reports", icon: "◔" },
  { id: "a7", kind: "action", title: "Feed de actividad", sub: "Histórico", href: "/activity", icon: "≡" },
  { id: "a8", kind: "action", title: "Empresas", sub: "Cuentas", href: "/companies", icon: "▤" },
  { id: "a9", kind: "action", title: "Ajustes", sub: "Workspace", href: "/settings", icon: "⚙" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("aurum:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aurum:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const search = useCallback(async (term: string) => {
    const t = term.trim();
    const actions = ACTIONS.filter(
      (a) => !t || a.title.toLowerCase().includes(t.toLowerCase())
    );
    if (!t) {
      setRows(actions);
      return;
    }
    const supabase = createClient();
    const like = `%${t}%`;
    const [c, co, d] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, email, company:companies(name)")
        .or(`name.ilike.${like},email.ilike.${like}`)
        .is("deleted_at", null)
        .limit(6),
      supabase
        .from("companies")
        .select("id, name, industry")
        .ilike("name", like)
        .is("deleted_at", null)
        .limit(4),
      supabase
        .from("deals")
        .select("id, name, value, stage, company:companies(name)")
        .ilike("name", like)
        .is("deleted_at", null)
        .limit(6),
    ]);

    const out: Row[] = [
      ...(c.data ?? []).map((r) => {
        const company = r.company as unknown as { name?: string } | null;
        return {
          id: r.id,
          kind: "contact" as const,
          title: r.name,
          sub: [company?.name, r.email].filter(Boolean).join(" · ") || "Contacto",
          href: `/contacts/${r.id}`,
          icon: initials(r.name),
        };
      }),
      ...(d.data ?? []).map((r) => {
        const company = r.company as unknown as { name?: string } | null;
        return {
          id: r.id,
          kind: "deal" as const,
          title: r.name,
          sub: `${eur(Number(r.value))} · ${STAGES[r.stage]}${
            company?.name ? ` · ${company.name}` : ""
          }`,
          href: `/deals/${r.id}`,
          icon: "▦",
        };
      }),
      ...(co.data ?? []).map((r) => ({
        id: r.id,
        kind: "company" as const,
        title: r.name,
        sub: r.industry || "Empresa",
        href: `/companies/${r.id}`,
        icon: "▤",
      })),
      ...actions,
    ];
    setRows(out);
    setActive(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(q), 160);
    return () => clearTimeout(t);
  }, [q, open, search]);

  const go = useMemo(
    () => (row: Row) => {
      setOpen(false);
      router.push(row.href);
    },
    [router]
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9996] flex items-start justify-center bg-[rgba(4,4,4,0.72)] px-6 pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[rgba(245,245,245,0.1)] bg-ink-900 shadow-[0_28px_70px_rgba(0,0,0,0.62)]"
      >
        <div className="flex items-center gap-3 border-b border-hair px-4 py-3.5">
          <span className="text-[14px] text-ink-450">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, rows.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && rows[active]) go(rows[active]);
            }}
            placeholder="Buscar contactos, deals, empresas o ir a…"
            className="flex-1 border-none bg-transparent text-[14px] text-ink-50 outline-none"
          />
          <kbd className="rounded border border-hair bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-auto py-1.5">
          {rows.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px] text-ink-400">
              Sin resultados para “{q}”.
            </div>
          )}
          {rows.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
              style={{ background: i === active ? "rgba(250,197,28,0.09)" : "transparent" }}
            >
              <span
                className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-ink-800 text-[10px] font-semibold"
                style={{ color: i === active ? GOLD : "#8A8A8A" }}
              >
                {r.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink-50">
                  {r.title}
                </span>
                <span className="block truncate text-[11.5px] text-ink-400">{r.sub}</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-ink-500">
                {r.kind === "action" ? "Ir" : r.kind === "contact" ? "Contacto" : r.kind === "deal" ? "Deal" : "Empresa"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
