"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

/** Body of a confirmation step inside a sheet: text, optional error, cancel/confirm. */
export function ConfirmBody({
  children,
  error,
  busy,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  children: ReactNode;
  error: string | null;
  busy: boolean;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)] text-slate-700">
      <p>{children}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
