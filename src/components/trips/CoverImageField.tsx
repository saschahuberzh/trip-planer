"use client";

import { useState } from "react";
import { ImageProcessingError, downscaleImage } from "@/lib/images/downscaleImage";
import type { CoverImageChange } from "@/lib/services/tripService";
import { BlobImage } from "@/components/ui/BlobImage";
import { ImageIcon } from "@/components/ui/icons";
import { TripCoverImage } from "./TripCoverImage";

type CoverImageFieldProps = {
  /** The trip's currently stored cover, if editing. */
  storedImageId: string | undefined;
  value: CoverImageChange;
  onChange: (value: CoverImageChange) => void;
  onProcessingChange: (processing: boolean) => void;
};

const actionClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-200 has-focus-visible:ring-2 has-focus-visible:ring-teal-600";

export function CoverImageField({ storedImageId, value, onChange, onProcessingChange }: CoverImageFieldProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showsStored = value.type === "keep" && storedImageId !== undefined;
  const hasImage = showsStored || value.type === "replace";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProcessing(true);
    onProcessingChange(true);
    try {
      onChange({ type: "replace", image: await downscaleImage(file) });
    } catch (caught) {
      setError(caught instanceof ImageProcessingError ? caught.message : "This image couldn't be added.");
    } finally {
      setProcessing(false);
      onProcessingChange(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">Cover photo</p>
      <div className="overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        {value.type === "replace" ? (
          <BlobImage blob={value.image.blob} alt="Selected cover photo" className="h-36 w-full object-cover" />
        ) : showsStored ? (
          <TripCoverImage imageId={storedImageId} seed="" label="" className="h-36 w-full" />
        ) : (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-slate-500">
            <ImageIcon className="size-8" />
            <span className="text-sm">{processing ? "Preparing photo…" : "No cover photo"}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <label className={actionClass}>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={processing}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {processing ? "Preparing…" : hasImage ? "Change photo" : "Add photo"}
        </label>
        {hasImage && !processing && (
          <button
            type="button"
            onClick={() => onChange(storedImageId === undefined ? { type: "keep" } : { type: "remove" })}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        )}
      </div>
      {error !== null && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-slate-500">Photos are resized and stored only on this device.</p>
    </div>
  );
}
