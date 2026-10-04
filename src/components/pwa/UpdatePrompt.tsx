"use client";

import { useEffect, useState } from "react";
import {
  activateWaitingWorker,
  isServiceWorkerEnabled,
  registerServiceWorker,
} from "@/lib/pwa/serviceWorkerClient";

/** Registers the service worker and shows an "Update available" prompt. */
export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!isServiceWorkerEnabled()) return;
    return registerServiceWorker((worker) => {
      setWaitingWorker(worker);
      setDismissed(false);
    });
  }, []);

  if (waitingWorker === null || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3 lg:bottom-4 lg:left-56"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
        <p className="flex-1 text-sm">Update available. Reload to use the new version.</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 rounded-xl px-3 text-sm text-slate-300"
        >
          Later
        </button>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            activateWaitingWorker(waitingWorker);
          }}
          className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {updating ? "Updating…" : "Reload"}
        </button>
      </div>
    </div>
  );
}
