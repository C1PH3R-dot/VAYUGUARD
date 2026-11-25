// ============================================================================
// Accessible Modal Dialog Shell (Escape-Key & Backdrop Dismissal)
// ============================================================================

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  titleId: string;
  title: React.ReactNode;
  closeLabel: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable accessible dialog container supporting Escape-key and backdrop dismissal.
 */
const ModalShell: React.FC<ModalShellProps> = ({
  titleId,
  title,
  closeLabel,
  maxWidthClass = 'max-w-lg',
  onClose,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        className={`${maxWidthClass} w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id={titleId}
            className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default ModalShell;
