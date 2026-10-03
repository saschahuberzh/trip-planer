"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { parseAppRoute, type AppRoute } from "./routes";

const noopSubscribe = () => () => {};

/**
 * The single way for client code to read route IDs.
 *
 * Reads the actual browser URL instead of Next.js route params, because offline
 * the service worker may answer `/trips/<id>/...` with a template page that was
 * prerendered for a placeholder ID.
 *
 * Returns null during server rendering and hydration (so server HTML never
 * depends on route IDs) and for paths that are not app routes.
 */
export function useAppRoute(): AppRoute | null {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return parseAppRoute(pathname);
}
