import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone, message) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-ink/10 bg-ink px-4 py-3 text-sm text-ivory shadow-lg animate-rise"
          >
            {t.tone === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#f0b8ab]" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" />
            )}
            <p className="flex-1">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="text-ivory/60 hover:text-ivory" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
