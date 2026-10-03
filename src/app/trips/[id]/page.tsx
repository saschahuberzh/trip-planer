import type { Metadata } from "next";
import { TripOverview } from "@/components/trips/TripOverview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <TripOverview />;
}
