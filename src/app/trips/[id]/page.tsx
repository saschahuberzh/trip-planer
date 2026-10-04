import type { Metadata } from "next";
import { OpenTripPlan } from "@/components/trips/OpenTripPlan";

export const metadata: Metadata = { title: "Trip" };

export default function Page() {
  return <OpenTripPlan />;
}
