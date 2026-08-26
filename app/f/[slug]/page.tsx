import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PublicForm from "@/components/PublicForm";
import type { FormField } from "@/components/FormBuilder";

export const dynamic = "force-dynamic";

/** Página pública del formulario. Sin sesión: se lee con la clave de servicio. */
async function loadForm(slug: string) {
  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!service) return null;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });
  const { data } = await admin
    .from("forms")
    .select("name, title, description, fields, submit_label, active, slug")
    .ilike("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const form = await loadForm(params.slug);
  return { title: form?.title || form?.name || "Formulario" };
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { embed?: string };
}) {
  const form = await loadForm(params.slug);
  if (!form || !form.active) notFound();

  const embed = searchParams.embed === "1";

  return (
    <div
      className={`flex min-h-screen justify-center bg-ink-950 px-5 ${
        embed ? "items-start py-8" : "items-center py-12"
      }`}
    >
      <div className="w-full max-w-[440px]">
        {!embed && (
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-[32px] w-[32px] place-items-center rounded-[9px] bg-gold text-[14px] font-bold text-ink-950">
              A
            </div>
            <div className="text-[13px] font-semibold tracking-[-0.01em]">Aurum</div>
          </div>
        )}

        <div className="panel p-7">
          <PublicForm
            slug={form.slug}
            title={form.title || form.name}
            description={form.description ?? ""}
            fields={(form.fields ?? []) as FormField[]}
            submitLabel={form.submit_label || "Enviar"}
            embed={embed}
          />
        </div>
      </div>
    </div>
  );
}
