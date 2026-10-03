import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Backup, storage and app information will appear here."
    />
  );
}
