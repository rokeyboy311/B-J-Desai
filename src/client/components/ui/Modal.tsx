import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full" | string;
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
    maxWidth === "4xl" ? "max-w-4xl" :
    maxWidth === "3xl" ? "max-w-3xl" :
    maxWidth === "2xl" ? "max-w-2xl" :
    maxWidth === "xl" ? "max-w-xl" :
    maxWidth === "lg" ? "max-w-lg" :
    maxWidth === "sm" ? "max-w-sm" :
    maxWidth === "full" ? "max-w-full m-2 sm:m-4" :
    "max-w-md";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full ${maxWidthClass} overflow-hidden flex flex-col max-h-[92vh] z-10 border border-slate-100 my-auto`}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
              <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {title}
              </div>
              <button 
                type="button" 
                onClick={onClose}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-700 transition-colors rounded-xl p-1.5 sm:p-2 hover:bg-slate-100 cursor-pointer ml-2 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 sm:p-5 overflow-y-auto" ref={contentRef}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
