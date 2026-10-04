import type { Metadata } from "next";
import { PlacesScreen } from "@/components/places/PlacesScreen";

export const metadata: Metadata = { title: "Places" };

export default function Page() {
  return <PlacesScreen />;
}
