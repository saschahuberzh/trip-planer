"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Trip } from "@/lib/domain/types";
import { useCurrentTrip } from "@/lib/hooks/useCurrentTrip";
import { appRoutePath } from "@/lib/routing/routes";
import { Button, buttonClass } from "@/components/ui/Button";
import { CalendarIcon, ChevronRightIcon, GlobeIcon, PencilIcon, TrashIcon, WalletIcon } from "@/components/ui/icons";
import { DeleteTripDialog } from "./DeleteTripDialog";
import { TripCoverImage } from "./TripCoverImage";
import { TripFormSheet } from "./TripFormSheet";
import {
  TRIP_STATUS_BADGE,
  TRIP_STATUS_LABELS,
  currencyName,
  formatMoney,
  tripDates,
  tripDuration,
} from "./tripDisplay";

/** Trip overview: key facts, edit and delete. */
export function TripOverview() {
  const trip = useCurrentTrip();

  if (trip.status === "loading") {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading trip">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
      </div>
    );
  }
  if (trip.status === "error") {
    return (
      <Message title="This trip couldn't be loaded">
        Your data has not been changed. Try reloading the app.
      </Message>
    );
  }
  if (trip.data === undefined) {
    return (
      <Message title="Trip not found">
        This trip doesn&apos;t exist on this device. It may have been deleted.
        <Link href={appRoutePath({ name: "trips" })} className={buttonClass("primary", "mt-4 w-full")}>
          Back to trips
        </Link>
      </Message>
    );
  }
  return <TripOverviewContent trip={trip.data} />;
}

function TripOverviewContent({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5">
      <div className="relative overflow-hidden rounded-3xl shadow-sm ring-1 ring-slate-200">
        <TripCoverImage imageId={trip.coverImageId} seed={trip.id} label={trip.name} className="h-44 w-full" />
        <span
          className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${TRIP_STATUS_BADGE[trip.status]}`}
        >
          {TRIP_STATUS_LABELS[trip.status]}
        </span>
      </div>

      <dl className="divide-y divide-slate-100 rounded-3xl bg-white px-4 shadow-sm ring-1 ring-slate-200">
        <Fact icon={<CalendarIcon />} label="Dates">
          {tripDates(trip)}
          <span className="block text-sm text-slate-500">{tripDuration(trip)}</span>
        </Fact>
        <Fact icon={<GlobeIcon />} label={trip.countries.length === 1 ? "Country" : "Countries"}>
          {trip.countries.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {trip.countries.map((country) => (
                <li key={country} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm">
                  {country}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500">No countries added</span>
          )}
        </Fact>
        <Fact icon={<WalletIcon />} label="Budget">
          {trip.budgetAmount !== undefined ? formatMoney(trip.budgetAmount, trip.baseCurrency) : "No budget set"}
          <span className="block text-sm text-slate-500">
            Base currency: {trip.baseCurrency} · {currencyName(trip.baseCurrency)}
          </span>
        </Fact>
      </dl>

      {trip.notes !== undefined && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-500">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-slate-800">{trip.notes}</p>
        </div>
      )}

      <Link
        href={appRoutePath({ name: "trip-section", tripId: trip.id, section: "plan" })}
        className="flex min-h-14 items-center justify-between rounded-3xl bg-teal-700 px-5 font-semibold text-white shadow-sm hover:bg-teal-800"
      >
        Open itinerary
        <ChevronRightIcon />
      </Link>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setDialog("edit")} className="flex-1">
          <PencilIcon />
          Edit trip
        </Button>
        <Button variant="secondary" onClick={() => setDialog("delete")} className="flex-1 text-red-600">
          <TrashIcon />
          Delete
        </Button>
      </div>

      <TripFormSheet open={dialog === "edit"} onClose={() => setDialog(null)} trip={trip} />
      <DeleteTripDialog
        trip={dialog === "delete" ? trip : null}
        onClose={() => setDialog(null)}
        onDeleted={() => router.replace(appRoutePath({ name: "trips" }))}
      />
    </section>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="mt-0.5 text-teal-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        <dd className="mt-0.5 font-medium text-slate-900">{children}</dd>
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-md px-4 py-6">
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-slate-600">{children}</div>
      </div>
    </section>
  );
}
