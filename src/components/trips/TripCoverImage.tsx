"use client";

import { useLiveData } from "@/lib/hooks/useLiveData";
import { getTripService } from "@/lib/services/tripService";
import { BlobImage } from "@/components/ui/BlobImage";

const GRADIENTS = [
  "from-teal-500 to-sky-600",
  "from-amber-400 to-rose-500",
  "from-indigo-500 to-fuchsia-500",
  "from-emerald-500 to-teal-700",
  "from-orange-400 to-amber-600",
  "from-sky-500 to-indigo-600",
];

function gradientFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

type TripCoverImageProps = {
  imageId: string | undefined;
  /** Stable seed for the placeholder gradient (the trip ID). */
  seed: string;
  /** Shown on the placeholder, usually the trip name. */
  label: string;
  className?: string;
};

/** Cover photo of a trip from local storage, or a colored placeholder. */
export function TripCoverImage({ imageId, seed, label, className = "" }: TripCoverImageProps) {
  const image = useLiveData(
    async () => (imageId === undefined ? undefined : getTripService().getImage(imageId)),
    [imageId],
  );
  const blob = image.status === "ready" ? image.data?.blob : undefined;

  if (blob !== undefined) return <BlobImage blob={blob} alt="" className={`object-cover ${className}`} />;
  return (
    <div
      aria-hidden="true"
      className={`flex items-end bg-gradient-to-br p-4 ${gradientFor(seed)} ${className}`}
    >
      <span className="text-4xl font-bold text-white/80">{label.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
