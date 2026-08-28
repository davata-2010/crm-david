"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import NotFound from "@/components/NotFound";
import QueryBoundary, { useQuery } from "@/components/QueryBoundary";
import FormBuilder, { type FormRow } from "@/components/FormBuilder";
import { useData } from "@/components/SessionGate";

export default function FormPage() {
  return (
    <QueryBoundary>
      <FormDetail />
    </QueryBoundary>
  );
}

function FormDetail() {
  const q = useQuery();
  const id = q.get("id") ?? "";

  const { data: loaded } = useData(async (s) => {
    const { data } = await s.supabase.from("forms").select("*").eq("id", id).maybeSingle();
    return { form: (data ?? null) as FormRow | null };
  }, [id]);

  if (!loaded) return <PageSkeleton />;
  if (!loaded.form)
    return <NotFound what="El formulario" back="/forms" backLabel="Ver formularios" />;

  return (
    <>
      <PageHeader crumb="Captación" title={loaded.form.name} />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <Link
          href="/forms"
          className="mb-4 inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Todos los formularios
        </Link>
        <FormBuilder form={loaded.form} />
      </div>
    </>
  );
}
