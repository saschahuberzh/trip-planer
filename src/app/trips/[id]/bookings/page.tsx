import type { Metadata } from "next";
import { BookingsScreen } from "@/components/bookings/BookingsScreen";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return <BookingsScreen />;
}
