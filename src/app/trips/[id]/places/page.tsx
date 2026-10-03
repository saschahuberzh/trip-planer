import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Places" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Places"
      description="Saved places will appear here."
    />
  );
}
