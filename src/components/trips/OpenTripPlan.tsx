"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { appRoutePath } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";
import { ScreenSkeleton } from "@/components/ui/ScreenState";

/** `/trips/<id>` has no screen of its own: a trip opens with its plan (old links keep working). */
export function OpenTripPlan() {
  const route = useAppRoute();
  const router = useRouter();
  const tripId = route?.name === "trip-overview" ? route.tripId : null;

  useEffect(() => {
    if (tripId !== null) router.replace(appRoutePath({ name: "trip-section", tripId, section: "plan" }));
  }, [tripId, router]);

  return <ScreenSkeleton label="Opening trip" />;
}
