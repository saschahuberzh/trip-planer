import { daysBetween, formatDurationMinutes, localDatePart, localTimePart } from "@/lib/domain/dateTime";
import type { Place, Transport, TransportType } from "@/lib/domain/types";
import { transportDurationMinutes } from "@/lib/services/transportForm";

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  car: "Car",
  taxi: "Taxi",
  ferry: "Ferry",
  walking: "Walk",
  other: "Transport",
};

/** Symbol per type, shared by the timeline and the map (SCREENS.md "Map"). */
export const TRANSPORT_SYMBOLS: Record<TransportType, string> = {
  flight: "✈️",
  train: "🚆",
  bus: "🚌",
  car: "🚗",
  taxi: "🚕",
  ferry: "⛴️",
  walking: "🚶",
  other: "➜",
};

function endName(placeId: string | undefined, text: string | undefined, places: ReadonlyMap<string, Place>): string | undefined {
  return (placeId === undefined ? undefined : places.get(placeId)?.name) ?? text;
}

/** "Tashkent → Samarkand", or undefined when neither end is known. */
function transportRoute(transport: Transport, places: ReadonlyMap<string, Place>): string | undefined {
  const origin = endName(transport.originPlaceId, transport.originText, places);
  const destination = endName(transport.destinationPlaceId, transport.destinationText, places);
  if (origin === undefined && destination === undefined) return undefined;
  return `${origin ?? "?"} → ${destination ?? "?"}`;
}

/** "Train · Tashkent → Samarkand". */
export function transportTitle(transport: Transport, places: ReadonlyMap<string, Place>): string {
  const route = transportRoute(transport, places);
  const label = TRANSPORT_TYPE_LABELS[transport.type];
  return route === undefined ? label : `${label} · ${route}`;
}

/** Local departure/arrival times as entered; `arrivalDays` > 0 when arriving on a later date. */
export function transportTimes(transport: Transport): { start?: string; end?: string; arrivalDays: number } {
  const { departure, arrival } = transport;
  return {
    start: departure === undefined ? undefined : localTimePart(departure),
    end: arrival === undefined ? undefined : localTimePart(arrival),
    arrivalDays:
      departure === undefined || arrival === undefined ? 0 : daysBetween(localDatePart(departure), localDatePart(arrival)),
  };
}

export function transportDurationLabel(transport: Transport): string | undefined {
  const minutes = transportDurationMinutes(transport);
  return minutes === undefined ? undefined : formatDurationMinutes(minutes);
}
