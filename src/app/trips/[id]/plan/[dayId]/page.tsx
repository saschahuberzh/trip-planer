import type { Metadata } from "next";
import { RouteIdLabel } from "@/components/navigation/RouteIdLabel";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import { ROUTE_TEMPLATE_ID } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Day" };

export function generateStaticParams() {
  return [{ dayId: ROUTE_TEMPLATE_ID }];
}

export default function Page() {
  return (
    <PlaceholderPage title="Day" description="Day details will appear here.">
      <RouteIdLabel kind="day" />
    </PlaceholderPage>
  );
}
