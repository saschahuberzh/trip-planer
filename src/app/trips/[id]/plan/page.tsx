import type { Metadata } from "next";
import { PlanScreen } from "@/components/itinerary/PlanScreen";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return <PlanScreen />;
}
