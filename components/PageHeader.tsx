"use client";

export default function PageHeader({
  crumb,
  title,
  subtitle,
  action,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-5 border-b border-hair bg-[rgba(8,8,8,0.9)] py-[18px] pl-16 pr-4 lg:px-9 lg:py-[22px]">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">{crumb}</div>
        <h1 className="mt-[5px] truncate text-[19px] font-semibold tracking-[-0.02em] lg:text-[22px]">
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-[12px] text-ink-400">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2.5">
        {action}
        <button
          onClick={() => window.dispatchEvent(new Event("aurum:palette"))}
          className="flex w-[42px] items-center justify-center gap-[9px] rounded-[9px] border border-[rgba(245,245,245,0.09)] bg-ink-900 px-[13px] py-[9px] text-left transition-colors hover:border-[rgba(250,197,28,0.4)] xl:w-[260px] xl:justify-start"
        >
          <span className="text-[13px] text-ink-450">⌕</span>
          <span className="hidden flex-1 text-[13px] text-ink-450 xl:block">Buscar en todo el CRM…</span>
          <kbd className="hidden rounded border border-hair bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400 xl:block">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
