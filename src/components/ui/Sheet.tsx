"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky bottom area, e.g. the primary actions. */
  footer?: ReactNode;
  /** Prevents closing (e.g. while saving). */
  dismissible?: boolean;
};

const noopSubscribe = () => () => {};

/**
 * Modal bottom sheet on phones, centered dialog on larger screens. Built on <dialog>
 * for focus handling and Escape support. Content is only mounted while open, so
 * forms start fresh each time.
 *
 * Rendered into <body> so that a sheet opened from inside another sheet's form never
 * puts a <form> inside a <form> in the DOM (invalid HTML: the inner form's submit is
 * then not handled by React and the browser submits it natively).
 */
export function Sheet({ open, onClose, title, children, footer, dismissible = true }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        // Only the dialog's own cancel (Escape). A dismissed file picker also fires
        // a bubbling "cancel" event from its <input>, which must not close the sheet.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === ref.current) requestClose();
      }}
      // A sheet opened from within another sheet's form (e.g. "new place" from the
      // activity form) must not submit that outer form: React events bubble along
      // the component tree.
      onSubmit={(event) => event.stopPropagation()}
      // Phones: a fixed-height sheet from below the status bar to the bottom of the *visible*
      // area (dvh excludes Safari's toolbars). A content-sized sheet anchored with margins
      // ended up mostly hidden behind iOS Safari's toolbar. Larger screens: centred dialog.
      className="inset-x-0 mx-auto mt-[calc(env(safe-area-inset-top)+2.5rem)] mb-0 h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] max-h-none w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 open:flex sm:my-auto sm:h-auto sm:max-h-[85dvh] sm:rounded-3xl"
    >
      {open && (
        <>
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="flex-1 text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={requestClose}
              disabled={!dismissible}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <CloseIcon />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer && (
            <footer className="border-t border-slate-100 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>,
    document.body,
  );
}
