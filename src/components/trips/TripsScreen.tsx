"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Trip } from "@/lib/domain/types";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { appRoutePath } from "@/lib/routing/routes";
import { DEFAULT_BASE_CURRENCY, getTripService } from "@/lib/services/tripService";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon, PencilIcon, PlusIcon, SuitcaseIcon, TrashIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { DeleteTripDialog } from "./DeleteTripDialog";
import { TripCard } from "./TripCard";
import { TripFormSheet } from "./TripFormSheet";
import { TRIP_GROUP_TITLES } from "./tripDisplay";

type Dialog =
  | { type: "create" }
  | { type: "actions"; trip: Trip }
  | { type: "edit"; trip: Trip }
  | { type: "delete"; trip: Trip }
  | null;

/** Home screen: locally stored trips grouped by status. */
export function TripsScreen() {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = useLiveData(async () => {
    const service = getTripService();
    const [groups, suggestedCurrency] = await Promise.all([
      service.listTripGroups(),
      service.suggestedBaseCurrency(),
    ]);
    return { groups, suggestedCurrency };
  }, []);

  const close = () => setDialog(null);
  const openCreate = () => setDialog({ type: "create" });
  const hasTrips = data.status === "ready" && data.data.groups.length > 0;

  return (
    <section className="mx-auto max-w-md px-4 pt-6 pb-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Trips</h1>
        {hasTrips && (
          <Button onClick={openCreate} className="rounded-full">
            <PlusIcon />
            New trip
          </Button>
        )}
      </header>

      {data.status === "loading" && <LoadingTrips />}

      {data.status === "error" && (
        <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          Your trips couldn&apos;t be loaded. Your data has not been changed — try reloading the app.
        </div>
      )}

      {data.status === "ready" && data.data.groups.length === 0 && <EmptyTrips onCreate={openCreate} />}

      {data.status === "ready" &&
        data.data.groups.map((group) => (
          <section key={group.status} className="mt-6" aria-labelledby={`trips-${group.status}`}>
            <h2 id={`trips-${group.status}`} className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              {TRIP_GROUP_TITLES[group.status]}
            </h2>
            <ul className="space-y-4">
              {group.trips.map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={trip} onShowActions={(selected) => setDialog({ type: "actions", trip: selected })} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      <TripFormSheet
        open={dialog?.type === "create" || dialog?.type === "edit"}
        onClose={close}
        trip={dialog?.type === "edit" ? dialog.trip : undefined}
        defaultBaseCurrency={data.status === "ready" ? data.data.suggestedCurrency : DEFAULT_BASE_CURRENCY}
        onSaved={(saved) => {
          if (dialog?.type === "create") router.push(appRoutePath({ name: "trip-overview", tripId: saved.id }));
        }}
      />

      <Sheet open={dialog?.type === "actions"} onClose={close} title={dialog?.type === "actions" ? dialog.trip.name : ""}>
        {dialog?.type === "actions" && (
          <ul className="-mx-2 space-y-1">
            <ActionItem
              icon={<ChevronRightIcon />}
              label="Open trip"
              onClick={() => router.push(appRoutePath({ name: "trip-overview", tripId: dialog.trip.id }))}
            />
            <ActionItem icon={<PencilIcon />} label="Edit trip" onClick={() => setDialog({ type: "edit", trip: dialog.trip })} />
            <ActionItem
              icon={<TrashIcon />}
              label="Delete trip"
              destructive
              onClick={() => setDialog({ type: "delete", trip: dialog.trip })}
            />
          </ul>
        )}
      </Sheet>

      <DeleteTripDialog trip={dialog?.type === "delete" ? dialog.trip : null} onClose={close} />
    </section>
  );
}

function ActionItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium hover:bg-slate-100 ${
          destructive ? "text-red-600" : "text-slate-800"
        }`}
      >
        {icon}
        {label}
      </button>
    </li>
  );
}

function EmptyTrips({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200">
      <div className="flex size-16 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <SuitcaseIcon className="size-8" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Plan your first trip</h2>
      <p className="mt-2 text-slate-600">
        Add where you&apos;re going and when. Everything is saved on this device and works without internet.
      </p>
      <Button onClick={onCreate} className="mt-6 rounded-full px-6">
        <PlusIcon />
        Create a trip
      </Button>
    </div>
  );
}

function LoadingTrips() {
  return (
    <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading trips">
      {[0, 1].map((key) => (
        <div key={key} className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
      ))}
    </div>
  );
}
