import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Trips" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Trips"
      description="Your trips will appear here. Creating trips arrives in a later version."
    />
  );
}
