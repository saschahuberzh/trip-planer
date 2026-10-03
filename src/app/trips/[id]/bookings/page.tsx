import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Bookings"
      description="Bookings will appear here."
    />
  );
}
