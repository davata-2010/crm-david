"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Alterna el modo edición de una ficha vía ?edit=1. */
export default function EditToggle({ label = "Editar" }: { label?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const editing = params.get("edit") === "1";

  return (
    <Link
      href={editing ? pathname : `${pathname}?edit=1`}
      className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-[15px] py-[9px] text-[12.5px] text-ink-50 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-ink-50"
    >
      {editing ? "Cancelar" : label}
    </Link>
  );
}
