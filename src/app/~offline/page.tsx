import type { Metadata } from "next";
import Link from "next/link";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Offline" };

/** Served by the service worker for unknown pages while offline. */
export default function OfflinePage() {
  return (
    <PlaceholderPage
      title="You are offline"
      description="This page is not available offline. Your trips are stored on this device and remain available."
    >
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 font-medium text-white">
        Go to trips
      </Link>
    </PlaceholderPage>
  );
}
