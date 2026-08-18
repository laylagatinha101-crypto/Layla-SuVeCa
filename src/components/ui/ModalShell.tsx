import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  maxWidth = 'max-w-xl',
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocus(isOpen, onClose, closeButtonRef);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`bg-white rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 shadow-xl w-full ${maxWidth} h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-200/60 transition"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
};
