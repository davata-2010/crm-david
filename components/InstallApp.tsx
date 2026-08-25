"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registra el service worker y ofrece instalar la app cuando el navegador deja. */
export default function InstallApp({ compact }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // En el layout sólo queremos el registro del service worker.
  if (compact) return null;

  if (installed)
    return (
      <div className="panel p-[26px]">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">Aplicación instalada</div>
        <div className="mt-1 text-[12.5px] text-ink-350">
          Estás usando Aurum como aplicación. Se actualiza sola con cada despliegue.
        </div>
      </div>
    );

  return (
    <div className="panel p-[26px]">
      <div className="text-[15px] font-semibold tracking-[-0.01em]">Instalar Aurum</div>
      <div className="mt-1 text-[12.5px] leading-[1.6] text-ink-350">
        Se instala desde el navegador, sin tiendas y sin coste. Queda como una app normal, con
        su icono, a pantalla completa y sin barra de direcciones.
      </div>

      {deferred ? (
        <button
          onClick={async () => {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setDeferred(null);
          }}
          className="mt-4 rounded-[10px] bg-gold px-5 py-3 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover"
        >
          Instalar ahora
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            title={platform === "ios" ? "iPhone y iPad · Safari" : "Android · Chrome"}
            steps={
              platform === "ios"
                ? [
                    "Abre la web en Safari (no vale Chrome en iOS).",
                    "Pulsa el botón Compartir, el cuadrado con la flecha.",
                    "Elige «Añadir a pantalla de inicio».",
                  ]
                : [
                    "Abre la web en Chrome.",
                    "Menú de tres puntos arriba a la derecha.",
                    "«Instalar aplicación» o «Añadir a pantalla de inicio».",
                  ]
            }
          />
          <Card
            title="Ordenador · Chrome o Edge"
            steps={[
              "Mira el icono de instalar en la barra de direcciones, a la derecha.",
              "O menú ⋮ → «Instalar Aurum…».",
              "Queda en el escritorio y en el menú de inicio.",
            ]}
          />
        </div>
      )}
    </div>
  );
}

function Card({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-[10px] border border-hair bg-ink-800 px-4 py-3.5">
      <div className="text-[12.5px] font-medium">{title}</div>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11.5px] leading-[1.55] text-ink-350">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
