/**
 * A short list of time zones for pickers: one per distinct UTC offset and daylight-saving
 * rule, labelled with well-known cities that share exactly these rules.
 */
import { isValidTimeZone } from "./dateTime";

export interface CommonTimeZone {
  timeZone: string;
  /** Cities using exactly this zone's rules (offset and daylight saving). */
  cities: string;
}

export const COMMON_TIME_ZONES: readonly CommonTimeZone[] = [
  { timeZone: "Pacific/Honolulu", cities: "Honolulu" },
  { timeZone: "America/Anchorage", cities: "Anchorage" },
  { timeZone: "America/Los_Angeles", cities: "Los Angeles, San Francisco, Vancouver" },
  { timeZone: "America/Phoenix", cities: "Phoenix" },
  { timeZone: "America/Denver", cities: "Denver, Calgary" },
  { timeZone: "America/Mexico_City", cities: "Mexico City, Guatemala" },
  { timeZone: "America/Chicago", cities: "Chicago, Houston" },
  { timeZone: "America/Bogota", cities: "Bogotá, Lima, Panama" },
  { timeZone: "America/New_York", cities: "New York, Toronto" },
  { timeZone: "America/Santiago", cities: "Santiago de Chile" },
  { timeZone: "America/Caracas", cities: "Caracas, La Paz, Santo Domingo" },
  { timeZone: "America/Sao_Paulo", cities: "São Paulo, Buenos Aires, Montevideo" },
  { timeZone: "Atlantic/Azores", cities: "Azores" },
  { timeZone: "Atlantic/Reykjavik", cities: "Reykjavík, Dakar, Accra" },
  { timeZone: "Europe/London", cities: "London, Dublin, Lisbon" },
  { timeZone: "Africa/Lagos", cities: "Lagos, Algiers, Tunis" },
  { timeZone: "Europe/Zurich", cities: "Zurich, Berlin, Paris, Rome, Madrid" },
  { timeZone: "Africa/Johannesburg", cities: "Johannesburg, Harare" },
  { timeZone: "Africa/Cairo", cities: "Cairo" },
  { timeZone: "Europe/Athens", cities: "Athens, Helsinki, Kyiv, Bucharest" },
  { timeZone: "Europe/Istanbul", cities: "Istanbul, Moscow, Riyadh, Nairobi" },
  { timeZone: "Asia/Tehran", cities: "Tehran" },
  { timeZone: "Asia/Dubai", cities: "Dubai, Baku, Tbilisi, Yerevan" },
  { timeZone: "Asia/Kabul", cities: "Kabul" },
  { timeZone: "Asia/Tashkent", cities: "Tashkent, Samarkand, Almaty, Karachi" },
  { timeZone: "Asia/Kolkata", cities: "Delhi, Mumbai, Colombo" },
  { timeZone: "Asia/Kathmandu", cities: "Kathmandu" },
  { timeZone: "Asia/Bishkek", cities: "Bishkek, Dhaka, Thimphu" },
  { timeZone: "Asia/Yangon", cities: "Yangon" },
  { timeZone: "Asia/Bangkok", cities: "Bangkok, Hanoi, Jakarta" },
  { timeZone: "Asia/Shanghai", cities: "Beijing, Singapore, Hong Kong, Perth" },
  { timeZone: "Asia/Tokyo", cities: "Tokyo, Seoul" },
  { timeZone: "Australia/Adelaide", cities: "Adelaide" },
  { timeZone: "Australia/Brisbane", cities: "Brisbane, Guam" },
  { timeZone: "Australia/Sydney", cities: "Sydney, Melbourne" },
  { timeZone: "Pacific/Noumea", cities: "Nouméa, Solomon Islands" },
  { timeZone: "Pacific/Auckland", cities: "Auckland" },
  { timeZone: "Pacific/Fiji", cities: "Fiji" },
];

/** Cities for a zone: from the list above, else its IANA city name ("Asia/Samarkand" → "Samarkand"). */
export function timeZoneCities(timeZone: string): string {
  const common = COMMON_TIME_ZONES.find((entry) => entry.timeZone === timeZone);
  return common?.cities ?? timeZone.split("/").at(-1)?.replace(/_/g, " ") ?? timeZone;
}

/** The common zones known to this browser (an outdated time zone database may lack some). */
export function availableCommonTimeZones(): CommonTimeZone[] {
  return COMMON_TIME_ZONES.filter((entry) => isValidTimeZone(entry.timeZone));
}
