"use client";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * El cliente de Supabase, uno solo para toda la aplicación.
 *
 * Antes se creaba con `createBrowserClient` de `@supabase/ssr`, que guarda la
 * sesión en cookies porque el servidor tenía que poder leerla. Ya no hay
 * servidor, y además un esquema propio como `aurum://` —el que sirve la
 * aplicación de escritorio— no admite cookies en Chromium: la sesión se
 * perdía en cada arranque. Con el cliente normal se guarda en el
 * almacenamiento local, que sí funciona tanto ahí como en el WebView de
 * Android.
 */

// El proyecto no tiene tipos generados de la base de datos, así que el
// esquema queda abierto; con el genérico por defecto, `maybeSingle()` devuelve
// `never` y no se puede leer ni una columna.
type Db = SupabaseClient<any, "public", any>;

let cached: Db | null = null;

export function createClient(): Db {
  if (cached) return cached;
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }
  );
  return cached;
}
