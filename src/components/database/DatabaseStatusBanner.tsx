"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  type DatabaseStatus,
  getDatabaseStatus,
  initializeLocalData,
  subscribeDatabaseStatus,
} from "@/lib/services/localData";

const SERVER_STATUS: DatabaseStatus = { state: "closed" };

function messageFor(status: DatabaseStatus): string | null {
  switch (status.state) {
    case "blocked":
      return "The app was updated. Close other open tabs or windows of this app to continue.";
    case "reload-required":
      return "The app was updated in another tab. Reload to continue.";
    case "error":
      return status.message;
    default:
      return null;
  }
}

/** Opens the local database on startup and reports upgrade/connection problems. */
export function DatabaseStatusBanner() {
  const status = useSyncExternalStore(subscribeDatabaseStatus, getDatabaseStatus, () => SERVER_STATUS);

  useEffect(() => {
    void initializeLocalData();
  }, []);

  const message = messageFor(status);
  if (message === null) return null;

  return (
    <div role="alert" className="sticky top-0 z-30 px-4 pt-3">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-950 shadow ring-1 ring-amber-200">
        <p className="flex-1 text-sm">{message}</p>
        {status.state !== "blocked" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
