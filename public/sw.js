/* Service worker de Aurum.
 *
 * Criterio: el CRM lee datos reales de Supabase, así que NO se cachea nada de
 * la API ni de las páginas con datos — mostrar un pipeline de hace tres días
 * sería peor que no mostrar nada. Sólo se cachea el armazón estático y una
 * pantalla de "sin conexión" para que la app abra en vez de dar error.
 */

const VERSION = "aurum-v3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/favicon.ico")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nada de la API ni de Supabase pasa por caché.
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;

  // Estáticos con hash en el nombre: caché primero, son inmutables.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navegación: siempre red. Si no hay, la pantalla de sin conexión.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((hit) => hit || new Response("Sin conexión", { status: 503 }))
      )
    );
  }
});
