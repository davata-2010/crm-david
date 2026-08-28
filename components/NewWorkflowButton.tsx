"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome } from "@/components/AppChrome";
import { createWorkflow } from "@/app/automations";
import { createForm } from "@/app/automations";
import { formHref, workflowHref } from "@/lib/routes";

export function NewWorkflowButton() {
  const router = useRouter();
  const { toast } = useChrome();
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createWorkflow();
          if (res?.error) toast(res.error, "error");
          else router.push(workflowHref(res.id));
        })
      }
      className="rounded-[9px] bg-gold px-4 py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
    >
      {pending ? "Creando…" : "+ Automatización"}
    </button>
  );
}

export function NewFormButton() {
  const router = useRouter();
  const { toast } = useChrome();
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createForm();
          if (res?.error) toast(res.error, "error");
          else router.push(formHref(res.id));
        })
      }
      className="rounded-[9px] bg-gold px-4 py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover disabled:opacity-50"
    >
      {pending ? "Creando…" : "+ Formulario"}
    </button>
  );
}

export default NewWorkflowButton;
