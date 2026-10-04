import type { Metadata } from "next";
import { DayScreen } from "@/components/itinerary/DayScreen";
import { ROUTE_TEMPLATE_ID } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Day" };

export function generateStaticParams() {
  return [{ dayId: ROUTE_TEMPLATE_ID }];
}

export default function Page() {
  return <DayScreen />;
}
