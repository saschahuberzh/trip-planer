import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Map" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Map"
      description="The trip map will appear here."
    />
  );
}
