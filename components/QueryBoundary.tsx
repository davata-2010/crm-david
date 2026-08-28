"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageSkeleton from "@/components/PageSkeleton";

/**
 * Los parámetros de la URL sólo se conocen en el navegador, así que React
 * necesita un límite de suspense alrededor de quien los lee. Envolver la
 * pantalla aquí evita repetir ese andamiaje en cada una.
 */
export default function QueryBoundary({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export function useQuery() {
  return useSearchParams();
}
