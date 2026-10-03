import type { Metadata } from "next";
import { RouteIdLabel } from "@/components/navigation/RouteIdLabel";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import { ROUTE_TEMPLATE_ID } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Place" };

export function generateStaticParams() {
  return [{ placeId: ROUTE_TEMPLATE_ID }];
}

export default function Page() {
  return (
    <PlaceholderPage title="Place" description="Place details will appear here.">
      <RouteIdLabel kind="place" />
    </PlaceholderPage>
  );
}
