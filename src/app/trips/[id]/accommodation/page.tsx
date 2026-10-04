import type { Metadata } from "next";
import { AccommodationScreen } from "@/components/accommodation/AccommodationScreen";

export const metadata: Metadata = { title: "Accommodation" };

export default function Page() {
  return <AccommodationScreen />;
}
