"use client";
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' };
type ToastCtx = { addToast: (m: string, t?: Toast['type']) => void };

const Ctx = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString(36);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="animate-slideInRight px-4 py-2 text-xs font-medium shadow-lg border" style={{ backgroundColor: t.type === 'success' ? '#dcfce7' : t.type === 'error' ? '#fee2e2' : '#e0f2fe', color: t.type === 'success' ? '#166534' : t.type === 'error' ? '#991b1b' : '#075985', borderColor: t.type === 'success' ? '#86efac' : t.type === 'error' ? '#fecaca' : '#bae6fd' }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
