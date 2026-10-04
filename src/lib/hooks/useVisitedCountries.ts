"use client";

import { getCountryService } from "@/lib/services/countryService";
import { useLiveData, type LiveData } from "./useLiveData";

/** Codes of the visited countries, kept up to date (also across tabs). */
export function useVisitedCountries(): LiveData<string[]> {
  return useLiveData(() => getCountryService().listVisitedCodes(), []);
}
