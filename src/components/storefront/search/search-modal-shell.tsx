'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * ADR-0064 — shared modal chrome for the storefront search dialogs: role=dialog + aria-modal, focus moved in
 * and restored on close, background scroll locked, Escape and backdrop click close it.
 */
export function SearchModalShell({
  isOpen,
  onClose,
  labelledBy,
  closeLabel,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first input if there is one (search fields), otherwise the dialog itself.
    const firstInput = dialogRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=file])');
    (firstInput ?? dialogRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Portal to <body>: the storefront header uses backdrop-blur (backdrop-filter), which makes it the containing
  // block for `position: fixed` descendants — without the portal the overlay would be clipped to the 64px header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative mt-[6dvh] max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl outline-none sm:mt-0 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Tab button used by both search dialogs. */
export function SearchTab({ active, onClick, icon, children, controls }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; controls?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
