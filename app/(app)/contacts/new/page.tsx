"use client";

import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import PageSkeleton from "@/components/PageSkeleton";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import { useData } from "@/components/SessionGate";

export default function NewContactPage() {
  return (
    <QueryBoundary>
      <NewContact />
    </QueryBoundary>
  );
}

function NewContact() {
  const q = useQuery();
  const { data: companies } = useData(async (s) => {
    const { data } = await s.supabase
      .from("companies")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");
    return data ?? [];
  });

  if (!companies) return <PageSkeleton />;

  return (
    <>
      <PageHeader crumb="Contactos" title="Nuevo contacto" />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="panel max-w-[720px] p-7">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">
            Datos del contacto
          </div>
          <div className="mb-6 mt-1 text-[12.5px] text-ink-350">
            Los campos marcados con · son obligatorios.
          </div>
          <ContactForm companies={companies} defaultCompanyId={q.get("company") ?? undefined} />
        </div>
      </div>
    </>
  );
}
