"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";

/**
 * Sustituye a `notFound()` de Next, que necesitaba un servidor que devolviera
 * un 404. Aquí el registro simplemente no está: puede haberse borrado desde
 * otro dispositivo, o el enlace ser viejo.
 */
export default function NotFound({
  what = "El registro",
  back = "/",
  backLabel = "Volver al panel",
}: {
  what?: string;
  back?: string;
  backLabel?: string;
}) {
  return (
    <>
      <PageHeader crumb="No encontrado" title={what} />
      <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
        <div>
          <p className="max-w-[340px] text-[13px] leading-[1.65] text-ink-400">
            {what} ya no existe. Puede que se haya enviado a la papelera desde otro
            dispositivo o que el enlace sea antiguo.
          </p>
          <Link
            href={back}
            className="mt-4 inline-block rounded-[10px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[12.5px] text-ink-150 transition-colors hover:border-gold hover:text-gold"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </>
  );
}
