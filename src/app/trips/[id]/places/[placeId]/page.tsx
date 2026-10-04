import type { Metadata } from "next";
import { PlaceDetailScreen } from "@/components/places/PlaceDetailScreen";
import { ROUTE_TEMPLATE_ID } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Place" };

export function generateStaticParams() {
  return [{ placeId: ROUTE_TEMPLATE_ID }];
}

export default function Page() {
  return <PlaceDetailScreen />;
}
