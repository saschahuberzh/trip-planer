"use client";

import type { Activity, TripDay } from "@/lib/domain/types";
import { entryRef, type TimelineEntry } from "@/lib/services/itineraryOrdering";
import { getItineraryService, type DayTimeline, type Itinerary } from "@/lib/services/itineraryService";
import { getPlaceService } from "@/lib/services/placeService";
import { PlacePickerSheet } from "@/components/places/PlacePickerSheet";
import { TripFormSheet } from "@/components/trips/TripFormSheet";
import { ActivitySheet } from "./ActivitySheet";
import { DayDetailsSheet, DeleteOutsideDaySheet } from "./DaySheets";
import { entryTitle, formatDayDate } from "./itineraryDisplay";
import { MoveSheet } from "./MoveSheet";

export type ItineraryDialog =
  | { type: "create-activity"; tripDayId: string | undefined }
  | { type: "edit-activity"; activity: Activity }
  | { type: "add-place"; tripDayId: string }
  | { type: "move-entry"; entry: TimelineEntry }
  | { type: "edit-day"; day: TripDay }
  | { type: "move-day-entries"; timeline: DayTimeline }
  | { type: "delete-day"; timeline: DayTimeline }
  | { type: "edit-trip" };

type ItineraryDialogsProps = {
  itinerary: Itinerary;
  dialog: ItineraryDialog | null;
  onClose: () => void;
  /** Called after an outside day was deleted. */
  onDayDeleted?: () => void;
};

/** All itinerary sheets, driven by one dialog state. */
export function ItineraryDialogs({ itinerary, dialog, onClose, onDayDeleted }: ItineraryDialogsProps) {
  const { trip, days, outsideDays } = itinerary;

  // Activities can be assigned to any day of the trip; an outside day is only offered
  // when the activity is already on it (so the form keeps its current value).
  const currentDayId = dialog?.type === "edit-activity" ? dialog.activity.tripDayId : undefined;
  const activityDays = [...days, ...outsideDays.filter((timeline) => timeline.day.id === currentDayId)];

  const activityTarget =
    dialog?.type === "create-activity"
      ? ({ mode: "create", tripDayId: dialog.tripDayId } as const)
      : dialog?.type === "edit-activity"
        ? ({ mode: "edit", activity: dialog.activity } as const)
        : null;

  return (
    <>
      <ActivitySheet
        tripId={trip.id}
        target={activityTarget}
        days={activityDays}
        places={itinerary.places}
        onClose={onClose}
      />

      <PlacePickerSheet
        open={dialog?.type === "add-place"}
        title="Visit a place"
        tripId={trip.id}
        places={[...itinerary.places.values()]}
        onPick={async (place) => {
          if (dialog?.type === "add-place") await getPlaceService().addPlaceToDay(place.id, dialog.tripDayId);
        }}
        onClose={onClose}
      />

      <MoveSheet
        open={dialog?.type === "move-entry"}
        title="Move to…"
        description={
          dialog?.type === "move-entry"
            ? `“${entryTitle(dialog.entry)}” is added at the end of the chosen day.`
            : ""
        }
        days={days}
        places={itinerary.places}
        currentTripDayId={dialog?.type === "move-entry" ? dialog.entry.item.tripDayId : undefined}
        onMove={async (tripDayId) => {
          if (dialog?.type === "move-entry") await getItineraryService().moveEntry(entryRef(dialog.entry), tripDayId);
        }}
        onClose={onClose}
      />

      <MoveSheet
        open={dialog?.type === "move-day-entries"}
        title="Move all items to…"
        description={
          dialog?.type === "move-day-entries"
            ? `All items of ${formatDayDate(dialog.timeline.day.date)} are added, in their order, at the end of the chosen day.`
            : ""
        }
        days={days}
        places={itinerary.places}
        currentTripDayId={dialog?.type === "move-day-entries" ? dialog.timeline.day.id : undefined}
        onMove={async (tripDayId) => {
          if (dialog?.type === "move-day-entries") {
            await getItineraryService().moveAllEntries(dialog.timeline.day.id, tripDayId);
          }
        }}
        onClose={onClose}
      />

      <DayDetailsSheet day={dialog?.type === "edit-day" ? dialog.day : null} onClose={onClose} />

      <DeleteOutsideDaySheet
        timeline={dialog?.type === "delete-day" ? dialog.timeline : null}
        onClose={onClose}
        onDeleted={onDayDeleted}
      />

      <TripFormSheet open={dialog?.type === "edit-trip"} onClose={onClose} trip={trip} />
    </>
  );
}
