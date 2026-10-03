import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Accommodation" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Accommodation"
      description="Accommodation will appear here."
    />
  );
}
