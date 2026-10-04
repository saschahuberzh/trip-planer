import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { VisitedCountry } from "@/lib/domain/types";
import { assertValidVisitedCountry } from "@/lib/domain/validation";

/** Visited countries (Countries tab), keyed by ISO 3166-1 alpha-2 code. */
export function createVisitedCountryRepository(db: TravelDatabase) {
  return {
    list(): Promise<VisitedCountry[]> {
      return db.visitedCountries.toArray();
    },

    /** Marks a country as visited; an existing entry is kept unchanged. */
    add(countryCode: string): Promise<VisitedCountry> {
      return db.transaction("rw", db.visitedCountries, async () => {
        const existing = await db.visitedCountries.get(countryCode);
        if (existing) return existing;
        const now = nowInstant();
        const country: VisitedCountry = { countryCode, createdAt: now, updatedAt: now };
        assertValidVisitedCountry(country);
        await db.visitedCountries.add(country);
        return country;
      });
    },

    /** Removes the mark. Nothing else references visited countries. */
    remove(countryCode: string): Promise<void> {
      return db.visitedCountries.delete(countryCode);
    },
  };
}

export type VisitedCountryRepository = ReturnType<typeof createVisitedCountryRepository>;
