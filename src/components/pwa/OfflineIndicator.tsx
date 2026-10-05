"use client";

import { useOnline } from "@/lib/hooks/useOnline";

/** Non-blocking note while the device is offline; everything except maps and place search keeps working. */
export function OfflineIndicator() {
  const online = useOnline();
  if (online) return null;
  return (
    <p role="status" className="bg-slate-800 px-4 py-1.5 text-center text-xs font-medium text-white lg:pl-60">
      Offline · your trips are saved on this device. Maps and place search need internet.
    </p>
  );
}
