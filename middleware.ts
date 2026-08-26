import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas que nunca necesitan sesión. */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/invite",
  "/offline",
  "/api/leads",
  "/api/forms",
  "/api/cron",
  "/f/",
  "/manifest.webmanifest",
  "/sw.js",
];

const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path.startsWith(p));

/** ¿Hay siquiera una cookie de sesión de Supabase? */
function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Camino rápido: sin cookie de sesión no hay nada que refrescar ni validar,
  // así que no se llama a Supabase. Antes esto costaba una ida y vuelta a
  // Irlanda incluso para abrir la pantalla de acceso.
  if (!hasAuthCookie(request)) {
    if (isPublic(path)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Con cookie sí llamamos: es lo que refresca el token caducado, y un Server
  // Component no puede escribir cookies por su cuenta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo menos:
     * - estáticos de Next y ficheros del PWA (nunca necesitan sesión)
     * - imágenes y fuentes
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
