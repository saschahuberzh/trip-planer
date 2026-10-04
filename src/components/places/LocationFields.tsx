"use client";

import { useId, useState } from "react";
import {
  formatCoordinate,
  isValidLatitude,
  isValidLongitude,
  parseCoordinateNumber,
  parseCoordinatesFromText,
  type LatLng,
} from "@/lib/domain/coordinates";
import { Button } from "@/components/ui/Button";
import { CloseIcon, LinkIcon, MapPinIcon } from "@/components/ui/icons";
import { Field, inputClass } from "@/components/trips/formFields";
import { MapPickerSheet } from "@/components/map/MapPickerSheet";

/** Optional coordinates: set on the map, from a pasted map link, or typed; removable. */
export function LocationFields({
  latitude: latitudeText,
  longitude: longitudeText,
  errors,
  near,
  onChange,
}: {
  latitude: string;
  longitude: string;
  errors: { latitude?: string; longitude?: string };
  near: LatLng | undefined;
  onChange: (latitude: string, longitude: string) => void;
}) {
  const linkId = useId();
  const [link, setLink] = useState("");
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const hasLocation = latitudeText.trim() !== "" || longitudeText.trim() !== "";
  const latitude = parseCoordinateNumber(latitudeText);
  const longitude = parseCoordinateNumber(longitudeText);
  const current =
    latitude !== null && longitude !== null && isValidLatitude(latitude) && isValidLongitude(longitude)
      ? { latitude, longitude }
      : null;

  function applyLink(text: string, showErrors: boolean) {
    if (text.trim() === "") {
      setLinkMessage(null);
      return;
    }
    const result = parseCoordinatesFromText(text);
    if (result.ok) {
      onChange(String(result.coordinates.latitude), String(result.coordinates.longitude));
      setLink("");
      setLinkMessage("Location taken from the link.");
    } else if (showErrors) {
      setLinkMessage(
        result.reason === "short-link"
          ? "Short links (like maps.app.goo.gl) don't contain coordinates. Search instead, or in Google Maps long-press the spot and copy the coordinates it shows."
          : "No coordinates found. Paste a map link that contains coordinates, or “41.31, 69.24”.",
      );
    }
  }

  return (
    <fieldset className="space-y-3 rounded-2xl p-3 ring-1 ring-slate-200">
      <legend className="px-1 text-sm font-medium text-slate-700">Location (optional)</legend>
      <p className="-mt-1 text-sm text-slate-500">
        {hasLocation ? "Shown on the map." : "Without coordinates the place is listed but not shown on the map."}
      </p>

      <Button variant="secondary" onClick={() => setPicking(true)} className="w-full">
        <MapPinIcon />
        {current ? "Adjust on map" : "Set on map"}
      </Button>

      <div className="space-y-1.5">
        <label htmlFor={linkId} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <LinkIcon className="size-4" />
          Paste a map link or coordinates
        </label>
        <div className="flex gap-2">
          <input
            id={linkId}
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              applyLink(event.target.value, false);
            }}
            onBlur={() => applyLink(link, true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink(link, true);
              }
            }}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Google/Apple Maps link"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => applyLink(link, true)}
            disabled={link.trim() === ""}
            className="min-h-11 shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 disabled:text-slate-400"
          >
            Use
          </button>
        </div>
        {linkMessage && <p className="text-sm text-slate-600">{linkMessage}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" error={errors.latitude}>
          {(props) => (
            <input
              {...props}
              value={latitudeText}
              onChange={(event) => onChange(event.target.value, longitudeText)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="41.311"
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Longitude" error={errors.longitude}>
          {(props) => (
            <input
              {...props}
              value={longitudeText}
              onChange={(event) => onChange(latitudeText, event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="69.240"
              className={inputClass}
            />
          )}
        </Field>
      </div>

      {hasLocation && (
        <button
          type="button"
          onClick={() => {
            onChange("", "");
            setLinkMessage(null);
          }}
          className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600"
        >
          <CloseIcon className="size-4" />
          Remove location
        </button>
      )}

      <MapPickerSheet
        open={picking}
        title="Set position"
        position={current}
        near={near}
        onConfirm={(position) => {
          onChange(formatCoordinate(position.latitude), formatCoordinate(position.longitude));
          setLinkMessage(null);
        }}
        onClose={() => setPicking(false)}
      />
    </fieldset>
  );
}
