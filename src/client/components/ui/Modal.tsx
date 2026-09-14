import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const maxWidthClass = 
    maxWidth === "3xl" ? "max-w-3xl" :
    maxWidth === "2xl" ? "max-w-2xl" :
    maxWidth === "xl" ? "max-w-xl" :
    maxWidth === "lg" ? "max-w-lg" :
    maxWidth === "sm" ? "max-w-sm" :
    "max-w-md";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`relative bg-white rounded-3xl shadow-2xl w-full ${maxWidthClass} overflow-hidden flex flex-col max-h-[90vh] z-10`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-20">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
              <button type="button" 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors rounded-xl p-2 hover:bg-slate-100/50"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" ref={contentRef}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
