"use client";

import Link from "next/link";
import { appRoutePath, tripSectionOf, type TripSection } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";

interface Tab {
  label: string;
  /** Section the tab opens. */
  section: TripSection;
  /** Sections shown as this tab. */
  sections: readonly TripSection[];
}

// Accommodation and other bookings share one tab (switch inside, see BookingsViewSwitch).
const TABS: readonly Tab[] = [
  { label: "Plan", section: "plan", sections: ["plan"] },
  { label: "Map", section: "map", sections: ["map"] },
  { label: "Places", section: "places", sections: ["places"] },
  { label: "Budget", section: "budget", sections: ["budget"] },
  { label: "Bookings", section: "accommodation", sections: ["accommodation", "bookings"] },
];

// Narrower on phones so all five tabs fit a 390 px wide screen.
const tabClass = "flex min-h-11 shrink-0 items-center rounded-full px-2.5 text-sm font-medium lg:px-4";

/** Horizontally scrollable trip section tabs. Links are built from the URL's trip ID. */
export function TripSectionNav() {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;
  const activeSection = route === null ? null : tripSectionOf(route);

  return (
    <nav aria-label="Trip sections" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-md gap-1.5 overflow-x-auto px-4 py-2 lg:max-w-6xl lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-8 lg:py-3">
        {TABS.map(({ label, section, sections }) => {
          // Before hydration the trip ID is unknown; render inert tabs.
          if (tripId === null) {
            return (
              <li key={label}>
                <span className={`${tabClass} text-slate-400`}>{label}</span>
              </li>
            );
          }
          const active = activeSection !== null && sections.includes(activeSection);
          return (
            <li key={label}>
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
