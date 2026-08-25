import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurum · AI Agency CRM",
    short_name: "Aurum",
    description:
      "CRM para agencias de IA: contactos, empresas, pipeline, tareas e informes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#080808",
    theme_color: "#080808",
    lang: "es",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pipeline", short_name: "Pipeline", url: "/pipeline" },
      { name: "Tareas", short_name: "Tareas", url: "/tasks" },
      { name: "Nuevo contacto", short_name: "Contacto", url: "/contacts/new" },
      { name: "Nuevo deal", short_name: "Deal", url: "/deals/new" },
    ],
  };
}
