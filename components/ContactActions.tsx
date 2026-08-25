"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import {
  bulkSetContactStatus,
  deleteContact,
  duplicateContact,
} from "@/app/actions";
import { CONTACT_STATUSES, STATUS } from "@/lib/constants";
import type { Contact } from "@/lib/types";

export default function ContactActions({ contact }: { contact: Contact }) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const [, start] = useTransition();

  function run(fn: () => Promise<{ error?: string } | void>, msg: string) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast(res.error, "error");
      else {
        toast(msg);
        router.refresh();
      }
    });
  }

  const items: MenuItem[] = [
    { kind: "label", label: contact.name },
    { label: "Editar", icon: "✎", onSelect: () => router.push(`/contacts/${contact.id}?edit=1`) },
    {
      label: "Duplicar",
      icon: "⧉",
      onSelect: () => run(() => duplicateContact(contact.id), "Contacto duplicado."),
    },
    {
      label: "Nuevo deal",
      icon: "＋",
      onSelect: () => router.push(`/deals/new?contact=${contact.id}`),
    },
    {
      label: "Añadir tarea",
      icon: "✓",
      onSelect: () => router.push(`/contacts/${contact.id}?task=1`),
    },
    { kind: "separator" },
    {
      label: "Enviar email",
      icon: "✉",
      disabled: !contact.email,
      onSelect: () => (window.location.href = `mailto:${contact.email}`),
    },
    {
      label: "Copiar email",
      icon: "⧉",
      disabled: !contact.email,
      onSelect: () => {
        navigator.clipboard.writeText(contact.email!);
        toast("Email copiado.");
      },
    },
    {
      label: "Copiar teléfono",
      icon: "⧉",
      disabled: !contact.phone,
      onSelect: () => {
        navigator.clipboard.writeText(contact.phone!);
        toast("Teléfono copiado.");
      },
    },
    { kind: "separator" },
    { kind: "label", label: "Cambiar estado" },
    ...CONTACT_STATUSES.map((s) => ({
      label: STATUS[s].label,
      icon: contact.status === s ? "●" : "○",
      disabled: contact.status === s,
      onSelect: () => run(() => bulkSetContactStatus([contact.id], s), "Estado actualizado."),
    })),
    { kind: "separator" },
    {
      label: "Eliminar contacto",
      icon: "✕",
      danger: true,
      onSelect: doDelete,
    },
  ];

  async function doDelete() {
    const ok = await confirm({
      title: `Eliminar a ${contact.name}`,
      message:
        "Se borrarán también todas sus actividades y tareas. Los deals asociados se conservan sin contacto. No se puede deshacer.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteContact(contact.id);
      if (res?.error) toast(res.error, "error");
      else {
        toast("Contacto eliminado.");
        router.push("/contacts");
      }
    });
  }

  return (
    <div className="flex gap-[9px]">
      <button
        onClick={(e) => openMenu(e, items)}
        className="rounded-[9px] border border-[rgba(245,245,245,0.1)] bg-ink-800 px-3 py-[9px] text-[13px] text-ink-150 transition-colors hover:border-[rgba(250,197,28,0.4)] hover:text-gold"
        title="Más acciones"
      >
        ⋯
      </button>
      <button
        onClick={doDelete}
        className="rounded-[9px] border border-[rgba(255,143,122,0.3)] bg-ink-800 px-[14px] py-[9px] text-[12.5px] text-[#FF8F7A] transition-colors hover:border-[#FF8F7A] hover:bg-[rgba(255,143,122,0.1)]"
      >
        Eliminar
      </button>
    </div>
  );
}
