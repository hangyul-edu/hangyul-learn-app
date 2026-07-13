import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastKind = "default" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, kind: ToastKind = "default") => {
    const id = seq++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const value: ToastCtx = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind !== "default" ? `toast--${t.kind}` : ""}`}>
            <span className="toast__icon">
              {t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "🔔"}
            </span>
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
