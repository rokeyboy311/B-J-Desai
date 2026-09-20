import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  confirmAction: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirmResolverRef = useRef<((val: boolean) => void) | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const normalizedOptions: ConfirmOptions =
      typeof options === "string" ? { message: options, isDanger: true } : options;

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal({
        isOpen: true,
        options: normalizedOptions,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(true);
      confirmResolverRef.current = null;
    }
    setConfirmModal(null);
  };

  const handleCancel = () => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmModal(null);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* Floating Toasts Notification Container */}
      <div 
        id="toast-notifications-container"
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 z-50 flex flex-col gap-2 pointer-events-none sm:max-w-sm w-auto"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-100"
                  : toast.type === "error"
                  ? "bg-rose-950/90 border-rose-500/40 text-rose-100"
                  : "bg-slate-900/90 border-slate-700/50 text-slate-100"
              }`}
            >
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}
              
              <div className="flex-1 text-xs font-medium leading-relaxed break-words">
                {toast.message}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-white/60 hover:text-white p-0.5 rounded-lg transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div 
            id="global-confirm-dialog-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${confirmModal.options.isDanger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {confirmModal.options.title || "Confirm Action"}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">Please review before continuing</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {confirmModal.options.message}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  id="confirm-dialog-cancel-btn"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {confirmModal.options.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  id="confirm-dialog-confirm-btn"
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
                    confirmModal.options.isDanger
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {confirmModal.options.confirmLabel || "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
