import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import FormBuilder, { type FormRow } from "@/components/FormBuilder";
import { getSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function FormPage({ params }: { params: { id: string } }) {
  const s = await getSession();
  const host = headers().get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const { data } = await s.supabase.from("forms").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <PageHeader crumb="Captación" title={data.name} />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <Link
          href="/forms"
          className="mb-4 inline-block text-[12.5px] text-ink-350 transition-colors hover:text-gold"
        >
          ← Todos los formularios
        </Link>
        <FormBuilder form={data as FormRow} origin={origin} />
      </div>
    </>
  );
}
