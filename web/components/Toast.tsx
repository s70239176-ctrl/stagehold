"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Alert } from "./icons.tsx";

interface ToastItem {
  id: number;
  kind: "ok" | "bad";
  title: string;
  body?: string;
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id">) => void }>({ push: () => undefined });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), t.kind === "bad" ? 11000 : 6500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "bad" ? "alert" : "status"}>
            {t.kind === "ok" ? <Check size={18} /> : <Alert size={18} />}
            <div>
              <b>{t.title}</b>
              {t.body ? <span>{t.body}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
