import Link from "next/link";

export default function NewButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[9px] bg-gold px-4 py-[9px] text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-gold-hover hover:text-ink-950"
    >
      {label}
    </Link>
  );
}
