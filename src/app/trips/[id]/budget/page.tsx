import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Budget" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Budget"
      description="Budget and expenses will appear here."
    />
  );
}
