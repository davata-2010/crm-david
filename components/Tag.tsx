import { tagStyle } from "@/lib/constants";

export default function Tag({
  tag,
  small,
  onRemove,
}: {
  tag: string;
  small?: boolean;
  onRemove?: () => void;
}) {
  const s = tagStyle(tag);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[6px] font-medium ${
        small ? "px-1.5 py-[1px] text-[10px]" : "px-2 py-[3px] text-[11px]"
      }`}
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {tag}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100">
          ✕
        </button>
      )}
    </span>
  );
}
