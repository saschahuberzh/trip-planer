"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { formatCoordinates } from "@/lib/domain/coordinates";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { useTripPlaces } from "@/lib/hooks/useTripPlaces";
import { appRoutePath } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";
import type { DayTimeline } from "@/lib/services/itineraryService";
import { getPlaceService, type PlaceSummary, type TripPlaces } from "@/lib/services/placeService";
import { Button, buttonClass } from "@/components/ui/Button";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { formatDayDate } from "@/components/itinerary/itineraryDisplay";
import { MoveSheet } from "@/components/itinerary/MoveSheet";
import { PLACE_TYPE_BADGE, PLACE_TYPE_LABELS, hasCoordinates } from "./placeDisplay";
import { PlaceFormSheet } from "./PlaceFormSheet";
import { LoadError, ScreenMessage, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

/** One place: details, favorite/visited, where it's used, add to day, edit, delete. */
export function PlaceDetailScreen() {
  const route = useAppRoute();
  const data = useTripPlaces();
  // Day list for "Add to day" (also creates missing trip days).
  const itinerary = useItinerary();
  const placeId = route?.name === "trip-place" ? route.placeId : null;

  if (data.status === "loading" || placeId === null) return <ScreenSkeleton />;
  if (data.status === "error") {
    return (
      <LoadError what="This place" />
    );
  }
  if (data.data === undefined) return <TripNotFound />;
  const summary = data.data.places.find((item) => item.place.id === placeId);
  const placesPath = appRoutePath({ name: "trip-section", tripId: data.data.trip.id, section: "places" });
  if (summary === undefined) {
    return (
      <ScreenMessage title="Place not found">
        This place doesn&apos;t exist in this trip. It may have been deleted.
        <Link href={placesPath} className={buttonClass("primary", "mt-4 w-full")}>
          Back to places
        </Link>
      </ScreenMessage>
    );
  }
  const days = itinerary.status === "ready" && itinerary.data !== undefined ? itinerary.data.days : [];
  return <PlaceContent data={data.data} summary={summary} days={days} placesPath={placesPath} />;
}

type PlaceContentProps = {
  data: TripPlaces;
  summary: PlaceSummary;
  days: DayTimeline[];
  placesPath: string;
};

function PlaceContent({ data, summary, days, placesPath }: PlaceContentProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "add-to-day" | "delete" | null>(null);
  const [toggleError, setToggleError] = useState(false);
  const { place, usages, dayStops } = summary;
  const tripId = data.trip.id;

  const toggle = (action: () => Promise<unknown>) => {
    setToggleError(false);
    action().catch((caught: unknown) => {
      console.error("Failed to update place", caught);
      setToggleError(true);
    });
  };

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5">
      <Link href={placesPath} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl pr-3 pl-1 text-sm font-medium text-teal-700">
        <ChevronLeftIcon />
        All places
      </Link>

      <header>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLACE_TYPE_BADGE[place.type]}`}>
          {PLACE_TYPE_LABELS[place.type]}
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{place.name}</h2>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={place.favorite}
          onClick={() => toggle(() => getPlaceService().setFavorite(place.id, !place.favorite))}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 ${
            place.favorite ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-white text-slate-700 ring-slate-200"
          }`}
        >
          <StarIcon fill={place.favorite ? "currentColor" : "none"} className="size-5 text-amber-500" />
          {place.favorite ? "Favorite" : "Mark favorite"}
        </button>
        <button
          type="button"
          aria-pressed={place.visited}
          onClick={() => toggle(() => getPlaceService().setVisited(place.id, !place.visited))}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 ${
            place.visited ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-white text-slate-700 ring-slate-200"
          }`}
        >
          <CheckCircleIcon className="size-5 text-emerald-600" />
          {place.visited ? "Visited" : "Mark visited"}
        </button>
      </div>
      {toggleError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          The change couldn&apos;t be saved.
        </p>
      )}

      <dl className="divide-y divide-slate-100 rounded-3xl bg-white px-4 shadow-sm ring-1 ring-slate-200">
        <Detail label="Address">{place.address ?? <span className="text-slate-500">No address</span>}</Detail>
        <Detail label="Coordinates">
          {hasCoordinates(place) ? (
            <span className="font-mono text-sm">{formatCoordinates(place)}</span>
          ) : (
            <span className="text-amber-700">Not set — this place won&apos;t appear on the map. Edit to add a location.</span>
          )}
        </Detail>
        {place.website !== undefined && (
          <Detail label="Website">
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center break-all text-teal-700 underline"
            >
              {place.website}
            </a>
          </Detail>
        )}
        {place.notes !== undefined && (
          <Detail label="Notes">
            <span className="whitespace-pre-line">{place.notes}</span>
          </Detail>
        )}
      </dl>

      <section aria-labelledby="usage-heading" className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <h3 id="usage-heading" className="px-4 pt-3 text-sm font-semibold text-slate-500">
          In your itinerary
        </h3>
        {dayStops.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {dayStops.map(({ day, dayNumber }) => (
              <li key={day.id}>
                <Link
                  href={appRoutePath({ name: "trip-day", tripId, dayId: day.id })}
                  className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-slate-50"
                >
                  <MapPinIcon className="size-5 shrink-0 text-teal-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      {dayNumber === null ? "Outside trip dates" : `Day ${dayNumber}`} · {formatDayDate(day.date)}
                    </span>
                    <span className="block text-sm text-slate-500">Place of the day</span>
                  </span>
                  <ChevronRightIcon className="size-5 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {usages.length === 0 && dayStops.length === 0 ? (
          <p className="px-4 pt-1 pb-3 text-slate-600">Not planned yet.</p>
        ) : usages.length === 0 ? null : (
          <ul className="divide-y divide-slate-100">
            {usages.map(({ activity, day, dayNumber }) => (
              <li key={activity.id}>
                <Link
                  href={
                    day === undefined
                      ? appRoutePath({ name: "trip-section", tripId, section: "plan" })
                      : appRoutePath({ name: "trip-day", tripId, dayId: day.id })
                  }
                  className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      {day === undefined
                        ? "Unplanned"
                        : `${dayNumber === null ? "Outside trip dates" : `Day ${dayNumber}`} · ${formatDayDate(day.date)}`}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {activity.startTime !== undefined && `${activity.startTime} · `}
                      {activity.title}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-slate-100 p-2">
          <Button variant="ghost" onClick={() => setDialog("add-to-day")} className="w-full text-teal-700">
            <CalendarIcon />
            Add to a day
          </Button>
        </div>
      </section>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setDialog("edit")} className="flex-1">
          <PencilIcon />
          Edit
        </Button>
        <Button variant="secondary" onClick={() => setDialog("delete")} className="flex-1 text-red-600">
          <TrashIcon />
          Delete
        </Button>
      </div>

      <PlaceFormSheet
        open={dialog === "edit"}
        tripId={tripId}
        places={data.places.map((item) => item.place)}
        place={place}
        onClose={() => setDialog(null)}
      />
      <MoveSheet
        open={dialog === "add-to-day"}
        title="Add to a day"
        description={`Adds “${place.name}” as an activity at the end of the chosen day.`}
        days={days}
        places={new Map(data.places.map((item) => [item.place.id, item.place]))}
        currentTripDayId={null}
        onMove={async (tripDayId) => {
          await getPlaceService().addPlaceToDay(place.id, tripDayId);
        }}
        onClose={() => setDialog(null)}
      />
      <DeletePlaceSheet
        summary={dialog === "delete" ? summary : null}
        onClose={() => setDialog(null)}
        onDeleted={() => router.replace(placesPath)}
      />
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}

function DeletePlaceSheet({
  summary,
  onClose,
  onDeleted,
}: {
  summary: PlaceSummary | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  async function confirm() {
    if (summary === null) return;
    setDeleting(true);
    setError(null);
    try {
      await getPlaceService().deletePlace(summary.place.id);
      onDeleted();
      close();
    } catch (caught) {
      console.error("Failed to delete place", caught);
      setError("The place couldn't be deleted. Nothing was removed.");
    } finally {
      setDeleting(false);
    }
  }

  const count = summary?.usages.length ?? 0;
  const dayCount = summary?.dayStops.length ?? 0;
  return (
    <Sheet
      open={summary !== null}
      onClose={close}
      title="Delete place?"
      dismissible={!deleting}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={close} disabled={deleting} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={deleting} className="flex-1">
            {deleting ? "Deleting…" : "Delete place"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-slate-700">
        <p>
          <strong className="text-slate-900">{summary?.place.name}</strong> will be permanently deleted from this device.
        </p>
        {count > 0 && (
          <p className="text-sm">
            {count === 1 ? "1 activity uses" : `${count} activities use`} this place.{" "}
            {count === 1 ? "It stays" : "They stay"} in your itinerary with {count === 1 ? "its" : "their"} title, without
            the place link.
          </p>
        )}
        {dayCount > 0 && (
          <p className="text-sm">
            It is removed as place of the day from {dayCount === 1 ? "1 day" : `${dayCount} days`}.
          </p>
        )}
        <p className="text-sm text-slate-500">This can&apos;t be undone.</p>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
