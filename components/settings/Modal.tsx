"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** "md" (default), "lg", "xl", or "2xl" for wider modal */
  size?: "md" | "lg" | "xl" | "2xl";
  /** Custom header content; when provided, replaces default title + close */
  headerContent?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = "md", headerContent }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative z-10 w-full bg-white mx-4 max-h-[90vh] overflow-hidden flex flex-col ${
          size === "2xl"
            ? "max-w-4xl rounded-[34px] shadow-2xl"
            : size === "xl"
              ? "max-w-2xl rounded-[34px] shadow-2xl"
              : size === "lg"
                ? "max-w-[560px] rounded-[34px] shadow-2xl"
                : "max-w-md rounded-[34px] shadow-xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {headerContent ? (
          <div className="border-b border-gray-200">{headerContent}</div>
        ) : (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 id="modal-title" className="text-lg font-medium text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
