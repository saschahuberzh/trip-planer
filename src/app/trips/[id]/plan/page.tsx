import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Plan"
      description="The day-by-day itinerary will appear here."
    />
  );
}
