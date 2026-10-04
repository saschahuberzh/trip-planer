"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Non-blocking note while the device is offline; everything except maps and place search keeps working. */
export function OfflineIndicator() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="bg-slate-800 px-4 py-1.5 text-center text-xs font-medium text-white lg:pl-60">
      Offline · your trips are saved on this device. Maps and place search need internet.
    </p>
  );
}
