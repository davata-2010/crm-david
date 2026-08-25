"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChrome, type MenuItem } from "@/components/AppChrome";
import { createClient } from "@/lib/supabase/client";
import { deleteAttachment, registerAttachment } from "@/app/actions";
import type { Attachment } from "@/lib/types";

const MAX = 25 * 1024 * 1024;

const prettySize = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function Attachments({
  items,
  workspaceId,
  contactId,
  dealId,
  canWrite,
}: {
  items: Attachment[];
  workspaceId: string;
  contactId?: string;
  dealId?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { openMenu, confirm, toast } = useChrome();
  const inputRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX) {
      toast("El fichero supera los 25 MB.", "error");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${workspaceId}/${crypto.randomUUID()}-${safe}`;

    const { error } = await supabase.storage.from("attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      toast(error.message, "error");
      return;
    }
    start(async () => {
      const res = await registerAttachment(
        path,
        file.name,
        file.size,
        file.type || "",
        contactId,
        dealId
      );
      setUploading(false);
      if (res?.error) toast(res.error, "error");
      else {
        toast("Adjunto subido.");
        router.refresh();
      }
    });
  }

  async function open(a: Attachment) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(a.path, 60);
    if (error || !data) {
      toast(error?.message ?? "No se pudo abrir el fichero.", "error");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function menu(a: Attachment): MenuItem[] {
    return [
      { kind: "label", label: a.name },
      { label: "Abrir", icon: "↗", onSelect: () => open(a) },
      {
        label: "Copiar nombre",
        icon: "⧉",
        onSelect: () => {
          navigator.clipboard.writeText(a.name);
          toast("Copiado.");
        },
      },
      ...(canWrite
        ? ([
            { kind: "separator" },
            {
              label: "Eliminar adjunto",
              icon: "✕",
              danger: true,
              onSelect: async () => {
                const ok = await confirm({
                  title: "Eliminar adjunto",
                  message: `"${a.name}" se borra del almacenamiento y no va a la papelera.`,
                  confirmLabel: "Eliminar",
                  danger: true,
                });
                if (ok)
                  start(async () => {
                    const res = await deleteAttachment(a.id, a.path);
                    if (res?.error) toast(res.error, "error");
                    else {
                      toast("Adjunto eliminado.");
                      router.refresh();
                    }
                  });
              },
            },
          ] as MenuItem[])
        : []),
    ];
  }

  return (
    <div className="panel px-[22px] pb-4 pt-[22px]">
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] font-semibold">Adjuntos</div>
        <span className="tnum text-[12px] text-ink-400">{items.length}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      <div className="mt-3 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="text-[12.5px] text-ink-400">
            Propuestas, contratos o cualquier documento de la cuenta.
          </div>
        )}
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => open(a)}
            onContextMenu={(e) => openMenu(e, menu(a))}
            className="flex items-center gap-2.5 rounded-[10px] border border-hair bg-ink-800 px-3 py-2.5 text-left transition-colors hover:border-[rgba(250,197,28,0.45)]"
          >
            <span className="text-[13px] text-ink-500">⎙</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{a.name}</span>
              <span className="block text-[11px] text-ink-400">{prettySize(a.size)}</span>
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                openMenu(e, menu(a));
              }}
              className="text-[14px] text-ink-500 hover:text-gold"
            >
              ⋯
            </span>
          </button>
        ))}
      </div>

      {canWrite && (
        <button
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 w-full rounded-[9px] border border-[rgba(250,197,28,0.35)] bg-ink-800 px-3 py-2.5 text-[12.5px] font-semibold text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink-950 disabled:opacity-50"
        >
          {uploading ? "Subiendo…" : "Subir fichero"}
        </button>
      )}
    </div>
  );
}
