/**
 * Place use cases: the trip's list of places (with derived planned status and the
 * activities using each place), create/edit/delete, favorite/visited, and adding a
 * place to a day. See DATA_MODEL.md "Place".
 */
import { calendarDaysInclusive } from "@/lib/domain/dateTime";
import type { Activity, Place, Trip, TripDay } from "@/lib/domain/types";
import { EntityNotFoundError, getRepositories, type NewEntity, type Repositories } from "@/lib/repositories";
import { createItineraryService } from "./itineraryService";
import { isOutsideTripDates } from "./tripDays";

/** Place fields edited by the user. */
export type PlaceInput = Omit<NewEntity<Place>, "tripId">;

export interface PlaceUsage {
  activity: Activity;
  /** undefined = the activity is Unplanned. */
  day?: TripDay;
  /** 1-based day within the trip dates; null when Unplanned or outside the dates. */
  dayNumber: number | null;
}

export interface PlaceDayStop {
  day: TripDay;
  /** 1-based day within the trip dates; null when outside the dates. */
  dayNumber: number | null;
}

export interface PlaceSummary {
  place: Place;
  /** Activities using this place, chronologically (Unplanned last). */
  usages: PlaceUsage[];
  /** Days listing this place as a place of the day, chronologically. */
  dayStops: PlaceDayStop[];
  /** Used on a day: by an activity assigned to a day or as a place of the day (derived). */
  planned: boolean;
}

export interface TripPlaces {
  trip: Trip;
  /** Sorted by name. */
  places: PlaceSummary[];
  days: TripDay[];
}

export function createPlaceService(repos: Repositories) {
  const itinerary = createItineraryService(repos);

  function summarize(trip: Trip, place: Place, activities: Activity[], days: TripDay[]): PlaceSummary {
    const daysById = new Map(days.map((day) => [day.id, day]));
    const dayNumber = (day: TripDay) =>
      isOutsideTripDates(day.date, trip) ? null : calendarDaysInclusive(trip.startDate, day.date);
    const usages = activities
      .filter((activity) => activity.placeId === place.id)
      .map((activity): PlaceUsage => {
        const day = activity.tripDayId === undefined ? undefined : daysById.get(activity.tripDayId);
        return { activity, day, dayNumber: day === undefined ? null : dayNumber(day) };
      })
      .sort((a, b) => {
        if (a.day === undefined || b.day === undefined) return a.day === undefined ? (b.day === undefined ? 0 : 1) : -1;
        return a.day.date < b.day.date ? -1 : a.day.date > b.day.date ? 1 : a.activity.sortOrder - b.activity.sortOrder;
      });
    // `days` are sorted by date.
    const dayStops = days
      .filter((day) => day.placeIds?.includes(place.id))
      .map((day): PlaceDayStop => ({ day, dayNumber: dayNumber(day) }));
    return {
      place,
      usages,
      dayStops,
      planned: dayStops.length > 0 || usages.some((usage) => usage.day !== undefined),
    };
  }

  async function loadTripPlaces(tripId: string): Promise<TripPlaces | undefined> {
    const trip = await repos.trips.get(tripId);
    if (!trip) return undefined;
    const [places, activities, days] = await Promise.all([
      repos.places.listByTrip(tripId),
      repos.activities.listByTrip(tripId),
      repos.tripDays.listByTrip(tripId),
    ]);
    const summaries = places
      .map((place) => summarize(trip, place, activities, days))
      .sort((a, b) => a.place.name.localeCompare(b.place.name, undefined, { sensitivity: "base" }));
    return { trip, places: summaries, days };
  }

  return {
    /** The trip's places with usage, or undefined if the trip does not exist. */
    listPlaces: loadTripPlaces,

    /** One place of the trip with its usage; undefined if trip or place is missing. */
    async getPlace(tripId: string, placeId: string): Promise<(TripPlaces & { summary: PlaceSummary }) | undefined> {
      const data = await loadTripPlaces(tripId);
      const summary = data?.places.find((item) => item.place.id === placeId);
      return data && summary ? { ...data, summary } : undefined;
    },

    createPlace(tripId: string, input: PlaceInput): Promise<Place> {
      return repos.places.create({ ...input, tripId });
    },

    updatePlace(id: string, input: PlaceInput): Promise<Place> {
      // Every key is listed so that cleared optional fields are removed.
      return repos.places.update(id, {
        name: input.name,
        type: input.type,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        website: input.website,
        notes: input.notes,
        favorite: input.favorite,
        visited: input.visited,
        externalRef: input.externalRef,
      });
    },

    setFavorite(id: string, favorite: boolean): Promise<Place> {
      return repos.places.update(id, { favorite });
    },

    setVisited(id: string, visited: boolean): Promise<Place> {
      return repos.places.update(id, { visited });
    },

    /**
     * Deletes the place. Activities keep their title and lose the link; transports and
     * accommodations receive the place's name/location (see placeRepository).
     */
    deletePlace(id: string): Promise<void> {
      return repos.places.delete(id);
    },

    /**
     * Creates an activity for the place at the end of the day (or Unplanned when
     * `tripDayId` is undefined). The title is the place name.
     */
    async addPlaceToDay(placeId: string, tripDayId: string | undefined): Promise<Activity> {
      const place = await repos.places.get(placeId);
      if (!place) throw new EntityNotFoundError("Place", placeId);
      return itinerary.createActivity(place.tripId, tripDayId, { title: place.name, placeId: place.id });
    },
  };
}

export type PlaceService = ReturnType<typeof createPlaceService>;

let service: PlaceService | null = null;

/** Place service bound to the app database (browser only). */
export function getPlaceService(): PlaceService {
  service ??= createPlaceService(getRepositories());
  return service;
}
