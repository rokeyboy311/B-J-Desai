import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, KeyRound, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch, setActiveDeletePassword } from "../lib/api";

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
  requirePassword?: boolean;
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

  const [deletePasswordInput, setDeletePasswordInput] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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

    setDeletePasswordInput("");
    setPasswordError("");
    setVerifyingPassword(false);

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal({
        isOpen: true,
        options: normalizedOptions,
        resolve,
      });
    });
  }, []);

  const handleConfirm = async () => {
    const needsPassword = confirmModal?.options.isDanger || confirmModal?.options.requirePassword;
    if (needsPassword) {
      if (!deletePasswordInput.trim()) {
        setPasswordError("Please enter the security password to confirm deletion.");
        return;
      }

      setVerifyingPassword(true);
      setPasswordError("");

      try {
        const res = await apiFetch("/auth/verify-delete-password", {
          method: "POST",
          body: JSON.stringify({ password: deletePasswordInput.trim() })
        });

        if (res && res.success) {
          // Set active delete password for following HTTP DELETE requests
          setActiveDeletePassword(deletePasswordInput.trim());
          if (confirmResolverRef.current) {
            confirmResolverRef.current(true);
            confirmResolverRef.current = null;
          }
          setConfirmModal(null);
          setDeletePasswordInput("");
        } else {
          setPasswordError(res?.error || "Incorrect security password. Access denied.");
        }
      } catch (err: any) {
        setPasswordError(err.message || "Incorrect security password. Deletion not authorized.");
      } finally {
        setVerifyingPassword(false);
      }
      return;
    }

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
    setDeletePasswordInput("");
    setPasswordError("");
    setActiveDeletePassword(null);
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

              {(confirmModal.options.isDanger || confirmModal.options.requirePassword) && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Security Password Verification
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      value={deletePasswordInput}
                      onChange={(e) => {
                        setDeletePasswordInput(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirm();
                        }
                      }}
                      placeholder="Enter security password to delete"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-inner"
                      autoFocus
                    />
                  </div>
                  {passwordError && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  id="confirm-dialog-cancel-btn"
                  onClick={handleCancel}
                  disabled={verifyingPassword}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {confirmModal.options.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  id="confirm-dialog-confirm-btn"
                  onClick={handleConfirm}
                  disabled={verifyingPassword}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                    confirmModal.options.isDanger
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  } disabled:opacity-50`}
                >
                  {verifyingPassword ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    confirmModal.options.confirmLabel || (confirmModal.options.isDanger ? "Verify & Delete" : "Confirm")
                  )}
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
