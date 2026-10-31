import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full" | string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "xl" }: ModalProps) {
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

  const getMaxWidthClass = () => {
    if (!maxWidth) return "max-w-xl";
    if (typeof maxWidth === "string" && maxWidth.startsWith("max-w-")) {
      return maxWidth;
    }
    switch (maxWidth) {
      case "sm": return "max-w-sm";
      case "md": return "max-w-md sm:max-w-lg";
      case "lg": return "max-w-lg sm:max-w-xl";
      case "xl": return "max-w-xl sm:max-w-2xl";
      case "2xl": return "max-w-2xl sm:max-w-3xl";
      case "3xl": return "max-w-3xl sm:max-w-4xl";
      case "4xl": return "max-w-4xl sm:max-w-5xl";
      case "5xl": return "max-w-5xl sm:max-w-6xl";
      case "6xl": return "max-w-6xl sm:max-w-7xl";
      case "7xl": return "max-w-7xl";
      case "full": return "max-w-[96vw]";
      default: return "max-w-xl sm:max-w-2xl";
    }
  };

  const maxWidthClass = getMaxWidthClass();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full ${maxWidthClass} max-w-[calc(100vw-1.25rem)] overflow-hidden flex flex-col max-h-[92vh] z-10 border border-slate-100 my-auto`}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0 gap-3">
              <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug min-w-0 flex-1 break-words">
                {title}
              </div>
              <button 
                type="button" 
                onClick={onClose}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-700 transition-colors rounded-xl p-1.5 sm:p-2 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden min-w-0" ref={contentRef}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
