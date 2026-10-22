import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback(({ title, description = '', type = 'info', duration = 4000 }) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, title, description, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(item => item.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback(id => {
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2.5 w-full max-w-md px-4 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map(toast => {
            const Icon =
              toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;
            const iconColor =
              toast.type === 'success'
                ? 'text-[#34c759]'
                : toast.type === 'error'
                ? 'text-[#ff3b30]'
                : 'text-[#0071e3]';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                className="pointer-events-auto w-full apple-glass hairline-border rounded-full px-5 py-3 shadow-appleModal flex items-center gap-3"
              >
                <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-apple-text truncate">{toast.title}</p>
                  {toast.description && (
                    <p className="text-xs text-apple-textSecondary truncate">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 rounded-full text-apple-textSecondary hover:text-apple-text transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
