"use client";

import Link from "next/link";
import { appRoutePath } from "@/lib/routing/routes";

const VIEWS = [
  { section: "accommodation", label: "Accommodation" },
  { section: "bookings", label: "Other bookings" },
] as const;

/** Switch between the two views of the Bookings tab (each keeps its own URL). */
export function BookingsViewSwitch({ tripId, current }: { tripId: string; current: "accommodation" | "bookings" }) {
  return (
    <nav aria-label="Bookings view" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {VIEWS.map(({ section, label }) => (
        <Link
          key={section}
          href={appRoutePath({ name: "trip-section", tripId, section })}
          replace
          aria-current={current === section ? "page" : undefined}
          className={`flex min-h-10 items-center justify-center rounded-lg text-sm font-medium ${
            current === section ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
