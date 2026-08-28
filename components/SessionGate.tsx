"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { loadSession, onChanged, type ClientSession } from "@/lib/session-client";

/**
 * Puerta de entrada de la aplicación.
 *
 * Hace el papel que antes hacían el middleware y `getSession()`: si no hay
 * usuario manda a /login, y si lo hay reparte la sesión a todas las pantallas
 * sin que ninguna vuelva a pedirla.
 */

const Ctx = createContext<{ session: ClientSession; reload: () => void } | null>(null);

export function useSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSession fuera de SessionProvider");
  return value.session;
}

/** Fuerza a recargar la sesión (contadores, equipo, workspace activo). */
export function useReloadSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useReloadSession fuera de SessionProvider");
  return value.reload;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    loadSession(true)
      .then((s) => {
        if (s) setSession(s);
        else router.replace("/login");
      })
      .catch(() => setFailed(true));
  }, [router]);

  useEffect(() => {
    let alive = true;
    loadSession()
      .then((s) => {
        if (!alive) return;
        if (s) setSession(s);
        else router.replace("/login");
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [router]);

  // Cualquier acción que toque contadores o equipo pide recargar la sesión.
  useEffect(() => onChanged((reloadSession) => reloadSession && reload()), [reload]);

  if (failed)
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center">
        <div>
          <div className="text-[15px] font-semibold text-ink-50">No hay conexión</div>
          <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-[1.6] text-ink-400">
            Aurum guarda tus datos en Supabase y necesita internet para leerlos. Comprueba
            la conexión y vuelve a intentarlo.
          </p>
          <button
            onClick={() => {
              setFailed(false);
              reload();
            }}
            className="mt-4 rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-950"
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  if (!session)
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hair border-t-gold" />
      </div>
    );

  return <Ctx.Provider value={{ session, reload }}>{children}</Ctx.Provider>;
}

/* ========================================================= datos ======= */

export type Data<T> = { data: T | null; loading: boolean; reload: () => void };

/**
 * Pide datos a Supabase y los vuelve a pedir cuando algo cambia.
 *
 * Es el reemplazo de lo que hacía cada Server Component: la misma consulta,
 * pero desde el navegador y repetida cuando una acción avisa.
 */
export function useData<T>(
  load: (session: ClientSession) => Promise<T>,
  deps: unknown[] = []
): Data<T> {
  const session = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  // La función de carga cambia en cada render; se guarda para que el efecto
  // dependa sólo de lo que el llamante declara.
  const fn = useRef(load);
  fn.current = load;

  const run = useCallback(() => {
    let alive = true;
    setLoading(true);
    fn.current(session)
      .then((result) => alive && setData(result))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ...deps]);

  useEffect(run, [run]);
  useEffect(() => onChanged(() => run()), [run]);

  return { data, loading, reload: run };
}
