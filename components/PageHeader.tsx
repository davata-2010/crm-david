"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageHeader({
  crumb,
  title,
  action,
}: {
  crumb: string;
  title: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");

  useEffect(() => {
    setQuery(params.get("q") || "");
  }, [params]);

  // Búsqueda global: escribe y salta a /contacts?q=…
  useEffect(() => {
    const current = params.get("q") || "";
    if (query === current) return;
    const t = setTimeout(() => {
      const target = pathname.startsWith("/contacts") ? pathname : "/contacts";
      router.push(query ? `${target}?q=${encodeURIComponent(query)}` : target);
    }, 280);
    return () => clearTimeout(t);
  }, [query, params, pathname, router]);

  return (
    <header className="flex items-center gap-5 border-b border-hair bg-[rgba(8,8,8,0.9)] px-9 py-[22px]">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">{crumb}</div>
        <h1 className="mt-[5px] truncate text-[22px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2.5">
        {action}
        <div className="flex w-[260px] items-center gap-[9px] rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-[13px] py-[9px]">
          <span className="text-[13px] text-ink-450">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar contactos, deals…"
            className="flex-1 border-none bg-transparent text-[13px] text-ink-50 outline-none"
          />
        </div>
      </div>
    </header>
  );
}
