export const metadata = { title: "Sin conexión · Aurum" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-[380px] text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] bg-gold text-[20px] font-bold text-ink-950">
          A
        </div>
        <h1 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">Sin conexión</h1>
        <p className="mx-auto mt-2 text-[12.5px] leading-[1.6] text-ink-350">
          Aurum necesita conexión para leer tus datos de Supabase. En cuanto vuelvas a tener
          red, recarga y sigues donde estabas.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-[10px] bg-gold px-5 py-3 text-[13.5px] font-semibold text-ink-950"
        >
          Reintentar
        </a>
      </div>
    </div>
  );
}
