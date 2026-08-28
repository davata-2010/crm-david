/**
 * Esqueleto que se pinta mientras una pantalla pide sus datos a Supabase.
 * Es la misma silueta de la tabla, así que el salto al contenido real no
 * mueve nada de sitio.
 */
export default function PageSkeleton() {
  return (
    <>
      <header className="flex items-center gap-5 border-b border-hair bg-[rgba(8,8,8,0.9)] py-[18px] pl-16 pr-4 lg:px-9 lg:py-[22px]">
        <div className="min-w-0 flex-1">
          <div className="h-[11px] w-[70px] animate-pulse rounded bg-ink-800" />
          <div className="mt-2 h-[20px] w-[190px] animate-pulse rounded bg-ink-800" />
        </div>
        <div className="h-[38px] w-[42px] animate-pulse rounded-[9px] bg-ink-900 xl:w-[260px]" />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="flex flex-wrap gap-2.5">
          {[76, 92, 108, 116].map((w) => (
            <div
              key={w}
              className="h-[34px] animate-pulse rounded-full bg-ink-900"
              style={{ width: w }}
            />
          ))}
        </div>

        <div className="panel mt-[18px] overflow-hidden">
          <div className="border-b border-hair bg-ink-915 px-5 py-3.5">
            <div className="h-[11px] w-[220px] animate-pulse rounded bg-ink-800" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[rgba(245,245,245,0.05)] px-5 py-[13px]"
              style={{ opacity: 1 - i * 0.09 }}
            >
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-ink-800" />
              <div className="min-w-0 flex-1">
                <div className="h-[12px] w-[38%] animate-pulse rounded bg-ink-800" />
                <div className="mt-2 h-[10px] w-[24%] animate-pulse rounded bg-ink-900" />
              </div>
              <div className="hidden h-[12px] w-[90px] animate-pulse rounded bg-ink-900 sm:block" />
              <div className="hidden h-[12px] w-[64px] animate-pulse rounded bg-ink-900 lg:block" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
