"use client";

import Link from "next/link";
import { TRIP_SECTIONS, appRoutePath, tripSectionOf, type TripSection } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";

const SECTION_LABELS: Record<TripSection, string> = {
  plan: "Plan",
  map: "Map",
  places: "Places",
  budget: "Budget",
  accommodation: "Accommodation",
  bookings: "Bookings",
};

const tabClass = "flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium";

/** Horizontally scrollable trip section tabs. Links are built from the URL's trip ID. */
export function TripSectionNav() {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;
  const activeSection = route === null ? null : tripSectionOf(route);

  return (
    <nav aria-label="Trip sections" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-md gap-2 overflow-x-auto px-4 py-2">
        {TRIP_SECTIONS.map((section) => {
          const label = SECTION_LABELS[section];
          // Before hydration the trip ID is unknown; render inert tabs.
          if (tripId === null) {
            return (
              <li key={section}>
                <span className={`${tabClass} text-slate-400`}>{label}</span>
              </li>
            );
          }
          const active = section === activeSection;
          return (
            <li key={section}>
              <Link
                href={appRoutePath({ name: "trip-section", tripId, section })}
                aria-current={active ? "page" : undefined}
                className={`${tabClass} ${active ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
