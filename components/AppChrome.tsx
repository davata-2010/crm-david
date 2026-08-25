"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ================================================================== tipos */

export type MenuItem =
  | { kind: "separator" }
  | { kind: "label"; label: string }
  | {
      kind?: "item";
      label: string;
      icon?: string;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    };

type Toast = { id: number; text: string; tone: "ok" | "error" };

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Chrome = {
  openMenu: (e: React.MouseEvent | MouseEvent, items: MenuItem[]) => void;
  toast: (text: string, tone?: "ok" | "error") => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
};

const ChromeCtx = createContext<Chrome | null>(null);

export function useChrome() {
  const ctx = useContext(ChromeCtx);
  if (!ctx) throw new Error("useChrome debe usarse dentro de <ChromeProvider>");
  return ctx;
}

/* =============================================================== provider */

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);
  const nextId = useRef(1);

  const openMenu = useCallback(
    (e: React.MouseEvent | MouseEvent, items: MenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      if (items.length === 0) return;
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    []
  );

  const toast = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    []
  );

  const value = useMemo(() => ({ openMenu, toast, confirm }), [openMenu, toast, confirm]);

  return (
    <ChromeCtx.Provider value={value}>
      {children}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      <ToastStack toasts={toasts} />
      {dialog && (
        <ConfirmDialog
          {...dialog}
          onDone={(v) => {
            dialog.resolve(v);
            setDialog(null);
          }}
        />
      )}
    </ChromeCtx.Provider>
  );
}

/* =========================================================== menú clic dcho */

const MENU_W = 232;

function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const left = Math.min(x, window.innerWidth - MENU_W - 10);
    const top = y + h > window.innerHeight - 10 ? Math.max(10, y - h) : y;
    setPos({ left: Math.max(10, left), top, ready: true });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: MENU_W,
        opacity: pos.ready ? 1 : 0,
        zIndex: 9999,
        background: "#141414",
        border: "1px solid rgba(245,245,245,0.1)",
        borderRadius: 11,
        padding: "5px 0",
        boxShadow: "0 18px 44px rgba(0,0,0,0.66)",
      }}
    >
      {items.map((item, i) => {
        if ("kind" in item && item.kind === "separator")
          return (
            <div
              key={i}
              style={{ height: 1, background: "rgba(245,245,245,0.08)", margin: "5px 0" }}
            />
          );
        if ("kind" in item && item.kind === "label")
          return (
            <div
              key={i}
              className="truncate px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-450"
            >
              {item.label}
            </div>
          );
        const it = item as Extract<MenuItem, { onSelect: () => void }>;
        return (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12.5px] transition-colors disabled:cursor-default disabled:opacity-35"
            style={{ color: it.danger ? "#FF8F7A" : "#E8E8E8", background: "transparent" }}
            onMouseEnter={(e) => {
              if (!it.disabled)
                e.currentTarget.style.background = it.danger
                  ? "rgba(255,143,122,0.1)"
                  : "rgba(250,197,28,0.1)";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="w-[15px] shrink-0 text-center text-[12px] opacity-80">
              {it.icon ?? ""}
            </span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-[10.5px] text-ink-450">{it.hint}</span>}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

/* ================================================================= toasts */

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9998] flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto min-w-[240px] max-w-[380px] rounded-[11px] px-4 py-3 text-[12.5px] shadow-[0_14px_36px_rgba(0,0,0,0.55)]"
          style={{
            background: "#141414",
            border: `1px solid ${
              t.tone === "error" ? "rgba(255,143,122,0.4)" : "rgba(250,197,28,0.35)"
            }`,
            color: t.tone === "error" ? "#FF8F7A" : "#F5F5F5",
          }}
        >
          <span className="mr-2">{t.tone === "error" ? "⚠" : "✓"}</span>
          {t.text}
        </div>
      ))}
    </div>,
    document.body
  );
}

/* =============================================================== confirmar */

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger,
  onDone,
}: ConfirmOpts & { onDone: (v: boolean) => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone(false);
      if (e.key === "Enter") onDone(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onDone]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9997] grid place-items-center bg-[rgba(4,4,4,0.72)] px-6"
      onClick={() => onDone(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-[14px] border border-[rgba(245,245,245,0.1)] bg-ink-900 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="text-[16px] font-semibold tracking-[-0.01em]">{title}</div>
        {message && (
          <div className="mt-2.5 text-[12.5px] leading-[1.6] text-ink-250">{message}</div>
        )}
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={() => onDone(false)}
            className="rounded-[9px] border border-[rgba(245,245,245,0.12)] px-4 py-2.5 text-[12.5px] text-ink-150 transition-colors hover:text-ink-50"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={() => onDone(true)}
            className="rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: danger ? "#FF8F7A" : "#FAC51C",
              color: "#080808",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
