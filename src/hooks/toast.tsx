import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastKind = "default" | "success" | "error";
interface ToastOptions {
  /** Show the leading status icon (default true; pass false for a clean message). */
  icon?: boolean;
  /** Visible time in ms before auto-dismiss (default 3000). */
  duration?: number;
}
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  icon: boolean;
}
interface ToastCtx {
  show: (message: string, kind?: ToastKind, opts?: ToastOptions) => void;
  success: (m: string) => void;
  error: (m: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let seq = 1;
const DEFAULT_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  // (Re)start the auto-dismiss timer for a toast — restarting keeps a repeated
  // message from stacking; the visible one just gets its countdown reset.
  const arm = useCallback(
    (id: number, duration: number) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const show = useCallback(
    (message: string, kind: ToastKind = "default", opts?: ToastOptions) => {
      const duration = opts?.duration ?? DEFAULT_DURATION;
      const icon = opts?.icon ?? true;
      setToasts((list) => {
        const existing = list.find((x) => x.message === message && x.kind === kind);
        if (existing) {
          arm(existing.id, duration); // same message already up → restart, don't stack
          return list;
        }
        const id = seq++;
        arm(id, duration);
        return [...list, { id, kind, message, icon }];
      });
    },
    [arm],
  );

  // Clear every pending timer if the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value: ToastCtx = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* "hg-" prefix: plain ".toast" classes are hidden by ad-blocker
          cosmetic filters (EasyList carries a ##.toast rule). */}
      <div className="hg-toast-wrap" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`hg-toast ${t.kind !== "default" ? `hg-toast--${t.kind}` : ""} ${t.icon ? "" : "hg-toast--plain"}`}
          >
            {t.icon && (
              <span className="hg-toast__icon">
                {t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "🔔"}
              </span>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used within ToastProvider");
  return c;
}
