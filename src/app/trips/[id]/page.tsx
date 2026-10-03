import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Overview"
      description="Trip details will appear here. Use the tabs above to open a section."
    />
  );
}
