"use client";

import { useEffect, useRef, type ImgHTMLAttributes } from "react";

type BlobImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { blob: Blob; alt: string };

/** Displays a locally stored Blob; its object URL is revoked when the Blob changes or on unmount. */
export function BlobImage({ blob, alt, ...props }: BlobImageProps) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const url = URL.createObjectURL(blob);
    img.src = url;
    return () => {
      img.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Local Blob URL; next/image optimization does not apply.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} {...props} />;
}
