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
  /** Optional extra classes for modal body wrapper */
  bodyClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, size = "md", headerContent, bodyClassName = "" }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`modal-surface relative z-10 w-full bg-white mx-4 h-[calc(100vh-1rem)] overflow-hidden flex flex-col ${
          size === "2xl"
            ? "max-w-4xl rounded-t-[24px] rounded-b-none shadow-2xl"
            : size === "xl"
              ? "max-w-2xl rounded-t-[24px] rounded-b-none shadow-2xl"
              : size === "lg"
                ? "max-w-[560px] rounded-t-[24px] rounded-b-none shadow-2xl"
                : "max-w-md rounded-t-[24px] rounded-b-none shadow-xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {headerContent ? (
          <div className="modal-header bg-white" style={{ backgroundColor: "#ffffff" }}>{headerContent}</div>
        ) : (
          <div className="modal-header bg-white flex items-center justify-between px-6 py-4" style={{ backgroundColor: "#ffffff" }}>
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
        <div className={`modal-body bg-white px-6 py-4 overflow-auto flex-1 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
