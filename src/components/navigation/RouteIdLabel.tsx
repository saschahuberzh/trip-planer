"use client";

import { useAppRoute } from "@/lib/routing/useAppRoute";

/** Shows the nested route ID (day or place) read from the URL. */
export function RouteIdLabel({ kind }: { kind: "day" | "place" }) {
  const route = useAppRoute();
  let id: string | null = null;
  if (kind === "day" && route?.name === "trip-day") id = route.dayId;
  if (kind === "place" && route?.name === "trip-place") id = route.placeId;

  return (
    <p className="mt-4 min-h-5 truncate font-mono text-xs text-slate-500" data-testid={`${kind}-id`}>
      {id}
    </p>
  );
}
