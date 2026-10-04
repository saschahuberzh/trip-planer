import type { Metadata } from "next";
import { CountriesScreen } from "@/components/countries/CountriesScreen";

export const metadata: Metadata = { title: "Countries" };

export default function Page() {
  return <CountriesScreen />;
}
