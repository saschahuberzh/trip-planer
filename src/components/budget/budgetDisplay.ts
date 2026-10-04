import { localDatePart } from "@/lib/domain/dateTime";
import type { Booking, ExpenseCategory, ExpenseLinkType, ExpenseStatus } from "@/lib/domain/types";
import { appRoutePath } from "@/lib/routing/routes";
import type { CurrencyAmount } from "@/lib/services/budget";
import type { ExpensePrefill } from "@/lib/services/expenseForm";
import type { Itinerary } from "@/lib/services/itineraryService";
import { BOOKING_TYPE_LABELS, bookingLinkOptions, linkKey } from "@/components/bookings/bookingDisplay";
import { formatMoney } from "@/components/trips/tripDisplay";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  food: "Food & drink",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export const EXPENSE_CATEGORY_SYMBOLS: Record<ExpenseCategory, string> = {
  accommodation: "🛏️",
  transport: "🚆",
  food: "🍽️",
  activities: "🎟️",
  shopping: "🛍️",
  other: "📦",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = { paid: "Paid", planned: "Planned" };

/** "KGS 1,200 · UZS 50,000". */
export function formatUnconverted(amounts: readonly CurrencyAmount[]): string {
  return amounts.map((item) => formatMoney(item.amount, item.currency)).join(" · ");
}

export interface ExpenseLinkOption {
  key: string;
  type: ExpenseLinkType;
  id: string;
  label: string;
  href: string;
  prefill: ExpensePrefill;
}

function categoryForBooking(type: Booking["type"]): ExpenseCategory {
  if (type === "flight" || type === "train") return "transport";
  if (type === "accommodation") return "accommodation";
  return type === "activity" ? "activities" : "other";
}

const price = (amount: number | undefined, currency: string | undefined) =>
  amount !== undefined && currency !== undefined ? { amount, currency } : undefined;

/** Everything an expense can link to, with what to fill in from it. */
export function expenseLinkOptions(itinerary: Itinerary, bookings: readonly Booking[]): ExpenseLinkOption[] {
  const options: ExpenseLinkOption[] = bookingLinkOptions(itinerary).map((option): ExpenseLinkOption => {
    const { entity } = option;
    const prefill: ExpensePrefill =
      entity.type === "transport"
        ? { title: entity.title, category: "transport", date: option.date, price: price(entity.item.price, entity.item.currency) }
        : entity.type === "accommodation"
          ? { title: entity.item.name, category: "accommodation", date: entity.item.checkInDate, price: price(entity.item.price, entity.item.currency) }
          : { title: entity.item.title, category: "activities", date: option.date };
    return { key: option.key, type: option.type, id: option.id, label: option.label, href: option.href, prefill };
  });
  for (const booking of bookings) {
    options.push({
      key: linkKey("booking", booking.id),
      type: "booking",
      id: booking.id,
      label: `${booking.title} · ${BOOKING_TYPE_LABELS[booking.type]}`,
      href: appRoutePath({ name: "trip-section", tripId: itinerary.trip.id, section: "bookings" }),
      prefill: {
        title: booking.title,
        category: categoryForBooking(booking.type),
        date: booking.dateTime ? localDatePart(booking.dateTime) : undefined,
        price: price(booking.price, booking.currency),
      },
    });
  }
  return options;
}
